import { app, BrowserWindow, shell, ipcMain, Tray, nativeImage, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';

const path = require('path');
const log = require('electron-log');
const settings = require('electron-settings');
const fs = require('fs-extra');

import * as Sentry from '@sentry/electron';
Sentry.init({
  dsn: 'https://2db185d22fdc4b5d844102a36714c0d1@sentry.io/1761306',
  environment: process.env.NODE_ENV,
  beforeSend(event) {
    // Check if it is an exception, if so, show the report dialog
    if (event.exception) {
      Sentry.showReportDialog({
        'title': "You've encountered an error.",
        'subtitle': "Explain the error as best you can below.",
        'subtitle2': "Error message: " + event.exception.values[0].type + ": " + event.exception.values[0].value,
      });
    }
    return event;
  }
});

/**
 * Set `__static` path to static files in production
 * https://simulatedgreg.gitbooks.io/electron-vue/content/en/using-static-assets.html
 */
if (process.env.NODE_ENV !== 'development') {
  global.__static = path.join(__dirname, '/static').replace(/\\/g, '\\\\')
}

let tray
let mainWindow
const winURL = process.env.NODE_ENV === 'development'
  ? `http://localhost:9080`
  : `file://${__dirname}/index.html`

function createWindow () {

  /**
   * Initial window options
   */
  mainWindow = new BrowserWindow({
    width: 1350,
    height: 800,
    minWidth: 860,
    minHeight: 484,
    backgroundColor: '#0b0c0f',
    useContentSize: true,
    autoHideMenuBar: true,
    show: false,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadURL(winURL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  }); 

  mainWindow.webContents.on('new-window', (e, url) => {
    e.preventDefault();
    shell.openExternal(url);
  });

  mainWindow.on('closed', () => {
    mainWindow = null
  });

  let app_name = 'DayZMagicLauncher';
  let menu = [];
  ['Home', 'Servers', 'Mods', 'Settings'].forEach((route) => {
    let route_path = route.toLowerCase();
    if (route == 'Home') {
      route_path = 'play';
    }
    menu.push({
      label: route,
      type: 'normal',
      click() {
        mainWindow.show();
        mainWindow.webContents.send('router_push', route_path);
      }
    });
  });
  tray = new Tray(path.join(app.getAppPath(), '/build/icons/icon.ico'));
  tray.setToolTip(app_name);
  tray.on('click', () => {
    mainWindow.show();
  });

  let last_played = null;
  ipcMain.on('last_played_server', (event, arg) => {
    last_played = arg;
    const contextMenu = Menu.buildFromTemplate([{
      type: 'separator',
    }, {
      label: 'Play '+(last_played !== null ? last_played.name : 'lol'),
      type: 'normal',
      click() {
  
      },
    }, {
      type: 'separator',
    }, ...menu, {
      type: 'separator',
    }, {
      label: 'Reload',
      type: 'normal',
      click() {
        mainWindow.reload();
      },
    }, {
      label: 'Check for updates...',
      type: 'normal',
      click() {
        autoUpdater.checkForUpdates();
      },
    }, {
      type: 'separator',
    }, {
      label: 'Quit '+app_name,
      type: 'normal',
      role: 'quit',
    }]);
    
    tray.setContextMenu(contextMenu);
  });
}

function sendToWeb(text) {
  mainWindow.webContents.send('update_message', text);
}

autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'debug';
if (process.env.NODE_ENV === 'production') {
  autoUpdater.checkForUpdates();
  setInterval(() => {
    autoUpdater.checkForUpdates();
  }, 1000 * 60 * 15); // check for updates every 15 minutes
}

autoUpdater.on('update-available', () => {
  sendToWeb('update_available');
});
autoUpdater.on('update-downloaded', () => {
  sendToWeb('update_downloaded');
});
autoUpdater.on('update-not-available', (info) => {
  sendToWeb('update_not_available');
});
autoUpdater.on('error', (err) => {
  sendToWeb(err);
});
ipcMain.on('install_update', (event, arg) => {
  autoUpdater.quitAndInstall();
});
ipcMain.on('check_for_update', (event, arg) => {
  autoUpdater.checkForUpdates();
});

if (process.env.NODE_ENV === 'development') app.setAppPath(process.cwd());

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow()
  }
});

app.on('before-quit', function() {
  tray.destroy();
});

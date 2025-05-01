const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const log = require('electron-log');
const iconPath = path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

log.transports.file.level = 'info';
log.info('Application starting...');

let mainWindow = null;
let pyProc = null;
let pythonPath = 'python';
let isMainAppLaunched = false;
let isCreatingMainWindow = false;
let serverPort = 8000;

const isDev = process.argv.includes('--dev');

function getPythonPath() {
  const possiblePaths = ['python', 'python3', 'py'];

  for (const pythonExec of possiblePaths) {
    try {
      const result = require('child_process').spawnSync(pythonExec, ['-c', 'print("Python found")']);
      if (result.status === 0) {
        log.info(`Using Python interpreter: ${pythonExec}`);
        return pythonExec;
      }
    } catch (e) {
      continue;
    }
  }

  log.warn('No Python interpreter found in PATH, defaulting to "python"');
  return 'python';
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return;
  }
  isCreatingMainWindow = true;

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1200,
    minHeight: 800,
    icon: fs.existsSync(iconPath) ? iconPath : null,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preloader.js')
    },
    show: false,
    backgroundColor: '#f0f9ff',
    frame: true,
    titleBarStyle: 'default'
  });

  try {
    if (fs.existsSync(path.join(__dirname, 'port.txt'))) {
      const portContent = fs.readFileSync(path.join(__dirname, 'port.txt'), 'utf8');
      serverPort = parseInt(portContent.trim(), 10);
      log.info(`Using port ${serverPort} from port.txt`);
    }
  } catch (err) {
    log.warn(`Could not read port.txt: ${err.message}, using default port ${serverPort}`);
  }

  mainWindow.loadURL(`http://localhost:${serverPort}/splash.html`);

  mainWindow.once('ready-to-show', () => {
    isCreatingMainWindow = false;
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow.webContents.getURL().includes('splash.html')) {
      checkBackendReady();
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    log.warn(`Failed to load: ${errorDescription} (${errorCode})`);
    if (errorCode === -102 || errorCode === -105 || errorCode === -6) {
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          log.info(`Retrying connection to backend on port ${serverPort}...`);
          mainWindow.loadURL(`http://localhost:${serverPort}/splash.html`);
        }
      }, 1000);
    }
  });
}

function checkBackendReady() {
  const http = require('http');
  const req = http.get(`http://localhost:${serverPort}`, (res) => {
    if (res.statusCode === 200) {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend-ready');
      }
    }
  });

  req.on('error', () => {
    setTimeout(checkBackendReady, 1000);
  });
}

app.whenReady().then(() => {
  log.info('Electron app ready');
  startPythonBackend();

  setTimeout(() => {
    createMainWindow();
  }, 2000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

ipcMain.on('launch-main-app', () => {
  if (isMainAppLaunched) return;
  isMainAppLaunched = true;

  log.info('Received launch-main-app command');
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.loadURL(`http://localhost:${serverPort}/index.html`);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    createMenu();
  }
});

ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  return result.canceled ? [] : result.filePaths;
});

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Load Files',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.executeJavaScript('document.getElementById("loadFilesBtn").click();');
          }
        },
        {
          label: 'Save Graph',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.executeJavaScript('document.getElementById("saveGraphBtn").click();');
          }
        },
        { type: 'separator' },
        {
          label: 'Reset Application',
          click: () => {
            mainWindow.webContents.executeJavaScript('document.getElementById("resetBtn").click();');
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Polaris Antenna Visualizer',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Polaris Antenna Visualizer',
              message: 'Polaris Antenna Visualizer v1.0.0',
              detail: 'A modern application for visualizing antenna radiation patterns in 2D and 3D.\n\nCreated with Electron, Python, and Eel.',
              buttons: ['OK'],
              icon: iconPath
            });
          }
        },
        {
          label: 'Documentation',
          click: async () => {
            await shell.openExternal('https://github.com/yourusername/polaris-antenna-visualizer/wiki');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function startPythonBackend() {
  pythonPath = getPythonPath();
  const script = path.join(__dirname, 'main.py');

  if (pyProc && !pyProc.killed) {
    log.info('Python backend already running');
    return;
  }

  log.info(`Starting Python backend: ${pythonPath} ${script}`);

  const env = { ...process.env, ELECTRON_RUN: '1' };
  pyProc = spawn(pythonPath, [script], { env });

  pyProc.stdout.on('data', (data) => {
    log.info(`Python [stdout]: ${data}`);
    const output = data.toString();
    const portMatch = output.match(/Starting Eel on port (\d+)/);
    if (portMatch && portMatch[1]) {
      serverPort = parseInt(portMatch[1], 10);
      log.info(`Backend is using port ${serverPort}`);
    }
  });

  pyProc.stderr.on('data', (data) => {
    log.error(`Python [stderr]: ${data}`);
  });

  pyProc.on('close', (code) => {
    log.info(`Python backend exited with code ${code}`);
    if (code !== 0 && mainWindow) {
      dialog.showErrorBox(
        'Python Backend Error',
        `The Python backend process exited unexpectedly with code ${code}. The application may not function correctly.`
      );
    }
  });

  pyProc.on('error', (err) => {
    log.error(`Failed to start Python process: ${err}`);
    dialog.showErrorBox(
      'Python Start Error',
      `Failed to start Python backend: ${err.message}`
    );
  });
}

function stopPythonBackend() {
  if (pyProc) {
    log.info('Stopping Python backend...');
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/pid', pyProc.pid, '/f', '/t']);
      } catch (error) {
        log.error(`Error stopping Python process: ${error}`);
      }
    } else {
      try {
        pyProc.kill('SIGTERM');
        setTimeout(() => {
          if (pyProc) {
            pyProc.kill('SIGKILL');
          }
        }, 1000);
      } catch (error) {
        log.error(`Error stopping Python process: ${error}`);
      }
    }
    pyProc = null;
  }
}

app.on('window-all-closed', () => {
  log.info('All windows closed');
  stopPythonBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  log.info('App is about to quit');
  app.isQuitting = true;
});

app.on('will-quit', () => {
  log.info('Application will quit');
  try {
    if (fs.existsSync(path.join(__dirname, 'port.txt'))) {
      fs.unlinkSync(path.join(__dirname, 'port.txt'));
    }
  } catch (err) {
    log.warn(`Error removing port.txt: ${err.message}`);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  stopPythonBackend();
});

process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  dialog.showErrorBox(
    'Error in Polaris Antenna Visualizer',
    `An unexpected error occurred:\n${error.message}\n\nThe application will now close.`
  );
  stopPythonBackend();
  app.quit();
});

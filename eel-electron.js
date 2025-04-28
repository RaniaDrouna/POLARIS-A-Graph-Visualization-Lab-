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
    // Focus on the existing window if someone tries to run a second instance
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// Configure logging
log.transports.file.level = 'info';
log.info('Application starting...');

// Global references
let mainWindow = null;
let pyProc = null;
let pythonPath = 'python'; // Default python command
let isMainAppLaunched = false;
let isCreatingMainWindow = false;

// In eel-electron.js, modify the createWindow function and add new functions



// Check if we're in development mode
const isDev = process.argv.includes('--dev');

// Find the best Python interpreter
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
      // Continue to next path
    }
  }

  log.warn('No Python interpreter found in PATH, defaulting to "python"');
  return 'python';
}

// Modify the createSplashWindow function
// In eel-electron.js, update the createSplashWindow and createMainWindow functions:

let isMainWindowCreated = false;

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
    frame: true, // Ensure window frame is visible
    titleBarStyle: 'default' // Standard title bar
  });

  // Load splash screen first
  mainWindow.loadURL('http://localhost:8000/splash.html');

  mainWindow.once('ready-to-show', () => {
    isCreatingMainWindow = false;
    mainWindow.show();
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow.webContents.getURL().includes('splash.html')) {
      // Start checking for backend readiness
      checkBackendReady();
    }
  });
}

function checkBackendReady() {
  const http = require('http');
  const req = http.get('http://localhost:8000', (res) => {
    if (res.statusCode === 200) {
      // Backend is ready, signal the UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('backend-ready');
      }
    }
  });

  req.on('error', () => {
    // Retry after delay
    setTimeout(checkBackendReady, 1000);
  });
}

function checkPortAvailable(port, callback) {
  const net = require('net');
  const server = net.createServer();

  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log.warn(`Port ${port} is already in use`);
      callback(false);
    }
  });

  server.once('listening', () => {
    server.close();
    callback(true);
  });

  server.listen(port);
}


// Modify the app.whenReady() event handler
app.whenReady().then(() => {
  log.info('Electron app ready');

  // Create the main window immediately without checking server first
  createMainWindow();

  // Then check if port is available, but don't block UI
  checkPortAvailable(8000, (available) => {
    if (available) {
      startPythonBackend();
    } else {
      log.warn('Port 8000 is already in use, assuming server is running');
      // Try to connect to existing server
      setTimeout(checkBackendReady, 1000);
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// Add this IPC handler to receive the launch command from splash screen
// Add this at the top

// Modify the IPC handler
ipcMain.on('launch-main-app', () => {
  if (isMainAppLaunched) return;
  isMainAppLaunched = true;

  log.info('Received launch-main-app command');
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Load main app regardless of backend status
    mainWindow.loadURL('http://localhost:8000/index.html');

    // Start Python backend if not already running
    if (!pyProc || pyProc.killed) {
      startPythonBackend();
    }

    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    createMenu();
  }
});

// Create application menu
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
              icon: path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png')
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

// In the startPythonBackend function
function startPythonBackend() {
  pythonPath = getPythonPath();
  const script = path.join(__dirname, 'main.py');
  // In startPythonBackend function, add this check at the beginning:
  if (pyProc && !pyProc.killed) {
    log.info('Python backend already running');
    return;
  }

  log.info(`Starting Python backend: ${pythonPath} ${script}`);

  // Use environment variables to signal to Python we're in an Electron app
  const env = { ...process.env, ELECTRON_RUN: '1' };

  pyProc = spawn(pythonPath, [script], { env });

  pyProc.stdout.on('data', (data) => {
    log.info(`Python [stdout]: ${data}`);
  });

  pyProc.stderr.on('data', (data) => {
    log.error(`Python [stderr]: ${data}`);

    // Check if Eel is already running (port in use error)
    if (data.toString().includes('OSError: [Errno 48]') ||
        data.toString().includes('Address already in use')) {
      log.info('Eel server seems to be already running, connecting to existing instance');
      // If Eel is running, create the window right away
      createSplashWindow();
    }
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
    app.quit();
  });
}
function stopPythonBackend() {
  if (pyProc) {
    log.info('Stopping Python backend...');

    // Try graceful shutdown first
    if (process.platform === 'win32') {
      try {
        spawn('taskkill', ['/pid', pyProc.pid, '/f', '/t']);
      } catch (error) {
        log.error(`Error stopping Python process: ${error}`);
      }
    } else {
      try {
        pyProc.kill('SIGTERM');
        // Give some time for the process to terminate
        setTimeout(() => {
          if (pyProc) {
            // Force kill if it didn't terminate
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

// Handle all windows closed
app.on('window-all-closed', () => {
  log.info('All windows closed');
  stopPythonBackend();

  // On macOS, applications keep running until the user quits explicitly
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Add this before app.on('will-quit')
app.on('before-quit', () => {
  log.info('App is about to quit');
  app.isQuitting = true;
});

// Handle app will quit
app.on('will-quit', () => {
  log.info('Application will quit');
  // Destroy all windows first
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.destroy();
  }
  // Then stop Python backend
  stopPythonBackend();
});

// Error handling
process.on('uncaughtException', (error) => {
  log.error('Uncaught exception:', error);
  dialog.showErrorBox(
    'Error in Polaris Antenna Visualizer',
    `An unexpected error occurred:\n${error.message}\n\nThe application will now close.`
  );

  stopPythonBackend();
  app.quit();
});

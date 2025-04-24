const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const log = require('electron-log');

// Configure logging
log.transports.file.level = 'info';
log.info('Application starting...');

// Global references
let mainWindow = null;
let pyProc = null;
let pythonPath = 'python'; // Default python command

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

// Create the main application window
function createWindow() {
  const iconPath = path.join(__dirname, 'build', process.platform === 'win32' ? 'icon.ico' : 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: fs.existsSync(iconPath) ? iconPath : null,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false, // Don't show until ready-to-show
    backgroundColor: '#f0f9ff' // Light blue background matching the app theme
  });

  // Load app from Eel web server
  mainWindow.loadURL('http://localhost:8000');

  // Show window when content has loaded
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();

    // Open DevTools automatically in development mode
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

// Modify the window closing handler
mainWindow.on('closed', () => {
  log.info('Main window closed');
  // Only stop Python when the app is actually quitting
  // This prevents stopping Python when window is closed but app still runs (macOS)
  if (process.platform !== 'darwin' || app.isQuitting) {
    stopPythonBackend();
  }
  mainWindow = null;
});

  // Create application menu
  createMenu();
}

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
      createWindow();
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

// Replace the app.whenReady() event handler
app.whenReady().then(() => {
  log.info('Electron app ready');

  // Check if Eel server is already running
  const checkServerRunning = () => {
    const http = require('http');
    const options = {
      host: 'localhost',
      port: 8000,
      path: '/',
      timeout: 1000
    };

    const req = http.get(options, (res) => {
      log.info(`Eel server is already running, status: ${res.statusCode}`);
      createWindow();
    });

    req.on('error', (err) => {
      log.info('Eel server not detected, starting Python backend');
      startPythonBackend();
      // Give the Python backend time to start
      setTimeout(createWindow, 1500);
    });
  };

  checkServerRunning();

  // macOS app activation behavior
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

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

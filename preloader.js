const { contextBridge, ipcRenderer } = require('electron');
const eel = require('eel'); // Add this at the top
contextBridge.exposeInMainWorld('eel', eel);


let isLaunching = false;

function launchApp() {
  if (isLaunching) return;
  isLaunching = true;
  console.log('Launching application...');
  ipcRenderer.send('launch-main-app');
}

function setupButtonListeners() {
  const buttonIds = ['loadFilesBtn', 'generateBtn', 'saveGraphBtn', 'resetBtn', 'toggle3dBtn',
                    'addColorBtn', 'removeColorBtn', 'closeColorModal', 'showHtmlBtn', 'addCustomColorBtn'];

  let allButtonsFound = true;

  buttonIds.forEach(id => {
    const button = document.getElementById(id);
    if (button) {
      if (button.disabled) {
        button.disabled = false;
        button.classList.remove('opacity-50');

        const originalOnClick = button.onclick;
        button.onclick = function(e) {
          console.log(`Button clicked: ${id}`);
          if (originalOnClick) {
            try {
              originalOnClick.call(this, e);
            } catch (err) {
              console.error(`Error in ${id} handler:`, err);
              if (id === 'loadFilesBtn' || id === 'generateBtn') {
                alert("The application is still starting up. Please try again in a moment.");
              }
            }
          }
        };
      }
    } else {
      allButtonsFound = false;
    }
  });

  if (!allButtonsFound) {
    setTimeout(setupButtonListeners, 100);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preloader script loaded');
  setupButtonListeners();

  const setupLaunchButton = () => {
    const launchButton = document.getElementById('launchButton');
    if (launchButton) {
      console.log('Launch button found, adding click listener');
      launchButton.disabled = false;
      launchButton.classList.remove('opacity-50');
      launchButton.addEventListener('click', launchApp);
      return true;
    }
    return false;
  };

  if (!setupLaunchButton()) {
    const launchButtonInterval = setInterval(() => {
      if (setupLaunchButton()) {
        clearInterval(launchButtonInterval);
      }
    }, 100);
  }

  const appVersion = '1.0.0';
  const versionElement = document.createElement('div');
  versionElement.className = 'fixed bottom-1 right-2 text-xs text-gray-500';
  versionElement.textContent = `Polaris v${appVersion}`;
  document.body.appendChild(versionElement);

  ipcRenderer.on('backend-ready', () => {
    console.log('Backend ready');
    const launchButton = document.getElementById('launchButton');
    if (launchButton) {
      launchButton.textContent = "Get Started";
      launchButton.classList.add('bg-green-600');
      launchButton.classList.remove('bg-blue-600');
      launchButton.classList.add('animate-pulse');
      setTimeout(() => {
        launchButton.classList.remove('animate-pulse');
      }, 3000);
    }
    setupButtonListeners();
  });

  enhanceUserInterface();

  const observer = new MutationObserver((mutations) => {
    setupButtonListeners();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});

function enhanceUserInterface() {
  document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      button.classList.add('opacity-70');
      setTimeout(() => {
        button.classList.remove('opacity-70');
      }, 200);
    });
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault();
      const generateBtn = document.getElementById('generateBtn');
      if (generateBtn && !generateBtn.disabled) {
        generateBtn.click();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      const loadFilesBtn = document.getElementById('loadFilesBtn');
      if (loadFilesBtn && !loadFilesBtn.disabled) {
        loadFilesBtn.click();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const saveGraphBtn = document.getElementById('saveGraphBtn');
      if (saveGraphBtn && !saveGraphBtn.disabled) {
        saveGraphBtn.click();
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      const resetBtn = document.getElementById('resetBtn');
      if (resetBtn && !resetBtn.disabled) {
        resetBtn.click();
      }
    }

    if (e.key === ' ' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      const toggle3dBtn = document.getElementById('toggle3dBtn');
      if (toggle3dBtn && !toggle3dBtn.disabled) {
        toggle3dBtn.click();
      }
    }
  });

  const welcomeMessage = document.createElement('div');
  welcomeMessage.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white py-2 px-4 rounded-lg shadow-lg transition-opacity duration-500';
  welcomeMessage.innerHTML = 'Welcome to Polaris Antenna Visualizer';
  document.body.appendChild(welcomeMessage);

  setTimeout(() => {
    welcomeMessage.classList.add('opacity-0');
    setTimeout(() => {
      welcomeMessage.remove();
    }, 500);
  }, 3000);
}

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  send: (channel, data) => {
    if (['launch-main-app'].includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    if (['message-from-main', 'backend-ready'].includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  launchApp: () => ipcRenderer.send('launch-main-app'),
  getAppVersion: () => '1.0.0',
  getPlatform: () => process.platform
});



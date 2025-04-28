const { contextBridge, ipcRenderer } = require('electron');

// Define the launchApp function
let isLaunching = false;

// Make sure the launchApp function is correctly triggering the IPC event
function launchApp() {
  if (isLaunching) return;
  isLaunching = true;
  console.log('Launching application...');
  ipcRenderer.send('launch-main-app');
}

// Execute code when the document is loaded
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preloader script loaded');

  // Enable the launch button immediately without waiting for backend-ready
  const launchButton = document.getElementById('launchButton');
  if (launchButton) {
    console.log('Launch button found, adding click listener');
    launchButton.disabled = false;
    launchButton.classList.remove('opacity-50');
    launchButton.addEventListener('click', launchApp);
  } else {
    // Button might be added dynamically, set up a mutation observer
    console.log('Launch button not found, setting up observer');
    const observer = new MutationObserver((mutations, obs) => {
      const button = document.getElementById('launchButton');
      if (button) {
        console.log('Launch button found via observer');
        button.disabled = false;
        button.classList.remove('opacity-50');
        button.addEventListener('click', launchApp);
        obs.disconnect(); // Stop observing once we've found the button
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Add all other button event listeners immediately
  setupButtonListeners();

  // Add version information to the UI
  const appVersion = '1.0.0'; // This should match your package.json

  // Add a small version indicator in the bottom corner
  const versionElement = document.createElement('div');
  versionElement.className = 'fixed bottom-1 right-2 text-xs text-gray-500';
  versionElement.textContent = `Polaris v${appVersion}`;
  document.body.appendChild(versionElement);

  // Still listen for backend-ready, but just for UI enhancement
  ipcRenderer.on('backend-ready', () => {
    console.log('Backend ready');
    const launchButton = document.getElementById('launchButton');
    if (launchButton) {
      launchButton.textContent = "Get Started";
      launchButton.classList.add('bg-green-600');
      launchButton.classList.remove('bg-blue-600');
      // Add a brief animation to indicate readiness
      launchButton.classList.add('animate-pulse');
      setTimeout(() => {
        launchButton.classList.remove('animate-pulse');
      }, 3000);
    }
  });

  // Add modern UI enhancements
  enhanceUserInterface();
});

function setupButtonListeners() {
  // Add direct listeners for all function buttons
  const buttonIds = ['loadFilesBtn', 'generateBtn', 'saveGraphBtn', 'resetBtn', 'toggle3dBtn'];

  buttonIds.forEach(id => {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = false;
      button.classList.remove('opacity-50');
    }
  });
}

// Add modern UI touches and animations
function enhanceUserInterface() {
  // Add loading transitions
  document.querySelectorAll('button').forEach(button => {
    button.addEventListener('click', () => {
      button.classList.add('opacity-70');
      setTimeout(() => {
        button.classList.remove('opacity-70');
      }, 200);
    });
  });

  // Add keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Ctrl+G or Cmd+G to generate graph
    if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
      e.preventDefault();
      const generateBtn = document.getElementById('generateBtn');
      if (generateBtn && !generateBtn.disabled) {
        generateBtn.click();
      }
    }

    // Ctrl+O or Cmd+O to load files
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
      e.preventDefault();
      const loadFilesBtn = document.getElementById('loadFilesBtn');
      if (loadFilesBtn && !loadFilesBtn.disabled) {
        loadFilesBtn.click();
      }
    }

    // Ctrl+S or Cmd+S to save graph
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      const saveGraphBtn = document.getElementById('saveGraphBtn');
      if (saveGraphBtn && !saveGraphBtn.disabled) {
        saveGraphBtn.click();
      }
    }

    // Ctrl+R or Cmd+R to reset (only with Shift to avoid browser refresh)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'R') {
      e.preventDefault();
      const resetBtn = document.getElementById('resetBtn');
      if (resetBtn && !resetBtn.disabled) {
        resetBtn.click();
      }
    }

    // Space to toggle 3D/2D
    if (e.key === ' ' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      const toggle3dBtn = document.getElementById('toggle3dBtn');
      if (toggle3dBtn && !toggle3dBtn.disabled) {
        toggle3dBtn.click();
      }
    }
  });

  // Add a welcome message that fades out after 3 seconds
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

// Expose protected methods to the splash screen
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    let validChannels = ['launch-main-app'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = ['message-from-main', 'backend-ready'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  launchApp: () => {
    launchApp();
  },
  getAppVersion: () => '1.0.0',
  getPlatform: () => process.platform
});


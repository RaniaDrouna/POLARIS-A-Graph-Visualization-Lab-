const { contextBridge, ipcRenderer } = require('electron');

// Define the launchApp function
let isLaunching = false;

// Make sure the launchApp function is correctly triggering the IPC event
function launchApp() {
  if (isLaunching) return;
  isLaunching = true;

  console.log('Launching main app...');

  // Add a transition effect
  document.body.classList.add('fade-out');

  setTimeout(() => {
    // Make sure this correctly triggers the IPC event
    ipcRenderer.send('launch-main-app');
  }, 300);
}

// Make sure the launch button is properly connected
window.addEventListener('DOMContentLoaded', () => {
  console.log('Preloader script loaded');

  const launchButton = document.getElementById('launchButton');
  if (launchButton) {
    console.log('Launch button found, adding click listener');
    launchButton.addEventListener('click', launchApp);
  } else {
    console.log('Launch button not found!');
  }

  // Auto-launch after a timeout
  if (!window.location.href.includes('index.html')) {
    console.log('Setting up auto-launch timer');
    setTimeout(() => {
      console.log('Auto-launching main app');
      launchApp();
    }, 5000);
  }
});

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

  // Add tooltips for controls if they don't exist
  const tooltips = [
    { selector: '#loadFilesBtn', text: 'Select antenna data files to visualize' },
    { selector: '#resetBtn', text: 'Reset the application to its initial state' },
    { selector: '#generateBtn', text: 'Generate the visualization with current settings' },
    { selector: '#saveGraphBtn', text: 'Save the current graph as an image' },
    { selector: '#toggle3dBtn', text: 'Switch between 2D and 3D visualization' },
    { selector: '#showHtmlBtn', text: 'Show HTML report view' }
  ];

  tooltips.forEach(tooltip => {
    const element = document.querySelector(tooltip.selector);
    if (element && !element.getAttribute('title')) {
      element.setAttribute('title', tooltip.text);
    }
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

// Execute code when the document is loaded
window.addEventListener('DOMContentLoaded', () => {
  // Add any custom initialization here
  console.log('Preload script loaded');

  // Add version information to the UI
  const appVersion = '1.0.0'; // This should match your package.json

  // Add a small version indicator in the bottom corner
  const versionElement = document.createElement('div');
  versionElement.className = 'fixed bottom-1 right-2 text-xs text-gray-500';
  versionElement.textContent = `Polaris v${appVersion}`;
  document.body.appendChild(versionElement);

  const launchButton = document.getElementById('launchButton');
  if (launchButton) {
    launchButton.addEventListener('click', () => {
      launchApp();
    });
  }

  // Auto-launch after a timeout if desired
if (!window.location.href.includes('index.html')) {
  setTimeout(() => {
    launchApp();
  }, 5000); // Only auto-launch from splash screen
} // Auto-launch after 5 seconds

  // Add modern UI enhancements
  enhanceUserInterface();
});

// Expose protected methods to the splash screen
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    let validChannels = ['launch-main-app'];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  receive: (channel, func) => {
    let validChannels = ['message-from-main'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  getAppVersion: () => '1.0.0',
  getPlatform: () => process.platform
});


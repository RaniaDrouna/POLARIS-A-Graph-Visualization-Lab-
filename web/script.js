// Global state
let loadedFiles = [];
let is3D = false;

// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
  // Initialize event listeners
  document.getElementById('loadFilesBtn').addEventListener('click', loadFiles);
  document.getElementById('resetBtn').addEventListener('click', resetApplication);
  document.getElementById('generateBtn').addEventListener('click', generateGraph);
  document.getElementById('addColorBtn').addEventListener('click', showColorPicker);
  document.getElementById('removeColorBtn').addEventListener('click', removeSelectedColor);
  document.getElementById('closeColorModal').addEventListener('click', hideColorPicker);
  document.getElementById('toggle3dBtn').addEventListener('click', toggle3DView);
  document.getElementById('saveGraphBtn').addEventListener('click', saveGraph);
  document.getElementById('showHtmlBtn').addEventListener('click', showHtmlView);
  document.getElementById('lineThickness').addEventListener('input', updateThicknessValue);
  document.getElementById('manualOffsetCheck').addEventListener('change', toggleOffsetMode);
  document.getElementById('autoOffsetCheck').addEventListener('change', toggleOffsetMode);
  document.getElementById('addCustomColorBtn').addEventListener('click', addCustomColor);
  document.getElementById('azimuthSlider').addEventListener('input', updateRotation);
  document.getElementById('elevationSlider').addEventListener('input', updateRotation);
  document.getElementById('themeToggle').addEventListener('change', changeTheme);

  // Initialize color picker
  const colorItems = document.querySelectorAll('.color-item');
  colorItems.forEach(item => {
    item.addEventListener('click', () => selectColor(item.dataset.color));
  });

  const titleContainer = document.querySelector('.title-container');
  if (titleContainer) {
    const titleText = titleContainer.querySelector('.title-text');
    if (titleText) {
      titleText.setAttribute('data-text', titleText.textContent);
      createStars(titleContainer, 20);
    }
  }

  initParticleBackground();

  // Update theme-specific elements when theme changes
  document.getElementById('themeToggle').addEventListener('change', function() {
    // This will repaint the canvas with the new theme colors
    // The canvas already reads the theme from body classes
  });
});

function initParticleBackground() {
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');

  // Set canvas dimensions
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  // Particle configuration
  const particleCount = 100;
  const particles = [];

  // Create particles
  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      radius: Math.random() * 2 + 1,
      speedX: Math.random() * 1 - 0.5,
      speedY: Math.random() * 1 - 0.5,
      color: `rgba(30, 64, 175, ${Math.random() * 0.5 + 0.1})`,
    });
  }

    // Update particle positions and draw them
  function animate() {
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Determine color based on theme
    const isDarkMode = document.body.classList.contains('dark-mode');
    const isSciFiMode = document.body.classList.contains('sci-fi-mode');

    // Update and draw particles
    particles.forEach(particle => {
      // Update position
      particle.x += particle.speedX;
      particle.y += particle.speedY;

      // Wrap around edges
      if (particle.x < 0) particle.x = canvas.width;
      if (particle.x > canvas.width) particle.x = 0;
      if (particle.y < 0) particle.y = canvas.height;
      if (particle.y > canvas.height) particle.y = 0;

      // Update color based on theme
      if (isSciFiMode) {
        particle.color = `rgba(0, 247, 255, ${Math.random() * 0.5 + 0.1})`;
      } else if (isDarkMode) {
        particle.color = `rgba(77, 123, 255, ${Math.random() * 0.5 + 0.1})`;
      } else {
        particle.color = `rgba(30, 64, 175, ${Math.random() * 0.5 + 0.1})`;
      }

      // Draw particle
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      ctx.fillStyle = particle.color;
      ctx.fill();
    });

    // Connect nearby particles with lines
    connectParticles();

    // Repeat animation
    requestAnimationFrame(animate);
  }

    function connectParticles() {
    const maxDistance = 150;

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < maxDistance) {
          const opacity = 1 - (distance / maxDistance);

          // Determine line color based on theme
          let lineColor;
          if (document.body.classList.contains('sci-fi-mode')) {
            lineColor = `rgba(0, 247, 255, ${opacity * 0.2})`;
          } else if (document.body.classList.contains('dark-mode')) {
            lineColor = `rgba(77, 123, 255, ${opacity * 0.2})`;
          } else {
            lineColor = `rgba(30, 64, 175, ${opacity * 0.2})`;
          }

          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = lineColor;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }
  }

  // Handle window resize
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  });

  // Start animation
  animate();
}

function createStars(container, count) {
  for (let i = 0; i < count; i++) {
    const star = document.createElement('div');
    star.classList.add('star');

    // Random position
    const left = Math.random() * 100;
    const top = Math.random() * 100;

    // Random size
    const size = Math.random() * 3 + 1;

    // Random animation delay
    const delay = Math.random() * 5;

    star.style.left = `${left}%`;
    star.style.top = `${top}%`;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    star.style.animationDelay = `${delay}s`;

    container.appendChild(star);
  }
}


// Update thickness value display
function updateThicknessValue() {
  const value = document.getElementById('lineThickness').value;
  document.getElementById('thicknessValue').textContent = parseFloat(value).toFixed(1);
}

// Load files from the system
async function loadFiles() {
  try {
    const numFiles = parseInt(document.getElementById('numFilesInput').value);
    if (isNaN(numFiles) || numFiles <= 0) {
      alert("Please enter a valid number of files.");
      return;
    }

    // Here we would normally use a file input, but Electron allows direct file selection
    // This is handled by Python in Eel
    const filePaths = await eel.select_files()();

    if (!filePaths || filePaths.length === 0) {
      alert("No files selected.");
      return;
    }

    loadedFiles = filePaths;
    if (loadedFiles.length > numFiles) {
      alert(`Selected ${loadedFiles.length} files, but only ${numFiles} will be displayed.`);
      loadedFiles = loadedFiles.slice(0, numFiles);
    }

    const result = await eel.charger_fichiers(loadedFiles)();
    showMessage(result);

    // Get data preview for the first file
    if (loadedFiles.length > 0) {
      const preview = await eel.get_data_preview(loadedFiles[0])();
      updateDataPreview(preview);
    }

    // Enable buttons after loading files
    document.getElementById('generateBtn').disabled = false;

    // Update stats dashboard with file count
    document.getElementById('statFiles').textContent = loadedFiles.length;
    document.getElementById('statsDashboard').classList.remove('hidden');
  } catch (error) {
    showMessage("Error loading files: " + error);
  }
}

// Add a new function to update the data preview
function updateDataPreview(preview) {
  const dataPreview = document.getElementById('dataPreview');
  const dataSummary = document.getElementById('dataSummary');

  if (preview.error) {
    dataSummary.textContent = `Error: ${preview.error}`;
  } else {
    dataSummary.textContent =
        `File: ${preview.file_name}
     Points: ${preview.points}
     Range: ${preview.min.toFixed(2)} to ${preview.max.toFixed(2)}
     Average: ${preview.mean.toFixed(2)}
     Sample: ${preview.sample.join(', ')}`;
  }

  dataPreview.classList.remove('hidden');
}

function changeTheme() {
  const theme = document.getElementById('themeToggle').value;
  document.body.className = ''; // Clear existing classes

  switch (theme) {
    case 'dark':
      document.body.classList.add('dark-mode');
      break;
    case 'sci-fi':
      document.body.classList.add('sci-fi-mode');
      break;
    default:
      // Light theme is default, no class needed
      break;
  }

  // Update glassmorphism panels when theme changes
  document.querySelectorAll('.glassmorphism').forEach(element => {
    // The CSS will handle the styling based on the body class
  });
}

// Generate and display the graph
async function generateGraph() {
  if (loadedFiles.length === 0) {
    showMessage("Please load files first.");
    return;
  }

  // Show loading indicator
  document.getElementById('noGraphMessage').classList.add('hidden');
  document.getElementById('loadingIndicator').classList.remove('hidden');
  document.getElementById('graphImage').classList.add('hidden');

  try {
    // Collect parameters
    const params = {
      offset_value: parseFloat(document.getElementById('offsetValue').value) || 0,
      offset_manual: document.getElementById('manualOffsetCheck').checked,
      offset_auto: document.getElementById('autoOffsetCheck').checked,
      scale_factor: parseFloat(document.getElementById('scaleFactor').value) || 1.0,
      type_tracage: document.getElementById('lineType').value,
      epaisseur_ligne: parseFloat(document.getElementById('lineThickness').value) || 2.0,
      est_3d: is3D
    };

    // Add rotation parameters if in 3D mode
    if (is3D) {
      params.azimuth = parseFloat(document.getElementById('azimuthSlider').value) || 45;
      params.elevation = parseFloat(document.getElementById('elevationSlider').value) || 30;
    }

    // Send parameters to Python
    await eel.set_params(params)();

    // Generate the graph
    const imagePath = await eel.generer_graphique()();

    if (!imagePath || imagePath.includes("Erreur")) {
      showMessage("Error generating graph: " + imagePath);
      return;
    }

    // Display the graph
    const img = document.getElementById('graphImage');
    img.src = imagePath + '?t=' + new Date().getTime(); // cache busting
    img.classList.remove('hidden');

    // Enable additional buttons
    document.getElementById('saveGraphBtn').disabled = false;
    document.getElementById('toggle3dBtn').disabled = false;

    // Update stats dashboard after generating graph
    updateStatsDashboard();
  } catch (error) {
    showMessage("Error generating graph: " + error);
  } finally {
    // Hide loading indicator
    document.getElementById('loadingIndicator').classList.add('hidden');
  }
}

// Add a new function to handle rotation updates
function updateRotation() {
  if (!is3D) return;

  // Show the updated values
  const azimuth = document.getElementById('azimuthSlider').value;
  const elevation = document.getElementById('elevationSlider').value;

  // If we want to update in real-time, we could regenerate the graph
  // But that might be too resource-intensive, so maybe use a debounce
  // For now, let's just store the values and use them on next generate
  generateGraph();
}

// Modify toggle3DView to show/hide rotation controls
function toggle3DView() {
  is3D = !is3D;
  document.getElementById('toggle3dBtn').textContent = is3D ? "Switch to 2D" : "Switch to 3D";

  // Show/hide rotation controls
  document.getElementById('rotationControls').classList.toggle('hidden', !is3D);

  generateGraph();
}

// Show color picker modal
function showColorPicker() {
  document.getElementById('colorModal').classList.remove('hidden');
}

// Hide color picker modal
function hideColorPicker() {
  document.getElementById('colorModal').classList.add('hidden');
}

// Add selected color to the list
async function selectColor(color) {
  try {
    const colors = await eel.ajouter_couleur(color)();
    updateColorList(colors);
    hideColorPicker();
  } catch (error) {
    showMessage("Error adding color: " + error);
  }
}

// Remove selected color from the list
async function removeSelectedColor() {
  const colorList = document.getElementById('colorList');
  const selectedIndex = colorList.selectedIndex;

  if (selectedIndex === -1) {
    alert("Please select a color to remove.");
    return;
  }

  try {
    const colors = await eel.supprimer_couleur(selectedIndex)();
    updateColorList(colors);
  } catch (error) {
    showMessage("Error removing color: " + error);
  }
}

// Update the color list display
function updateColorList(colors) {
  const colorList = document.getElementById('colorList');
  colorList.innerHTML = '';

  colors.forEach(color => {
    const option = document.createElement('option');
    option.value = color;
    option.textContent = color;
    option.style.backgroundColor = color;
    option.style.color = isLightColor(color) ? 'black' : 'white';
    colorList.appendChild(option);
  });
}

// Determine if a color is light (for text contrast)
function isLightColor(color) {
  // Simple implementation - can be improved
  const lightColors = ['yellow', 'cyan', 'pink'];
  return lightColors.includes(color);
}


async function updateStatsDashboard() {
  try {
    const stats = await eel.get_graph_stats()();

    if (stats.error) {
      console.error("Error getting stats:", stats.error);
      return;
    }

    // Update the dashboard with stats from the first file (or aggregate if needed)
    document.getElementById('statFiles').textContent = loadedFiles.length;

    if (stats.length > 0) {
      document.getElementById('statMax').textContent = stats[0].max_gain.toFixed(2);
      document.getElementById('statPeak').textContent = stats[0].peak_angle.toFixed(1) + "°";
    }

    // Show the dashboard
    document.getElementById('statsDashboard').classList.remove('hidden');
  } catch (error) {
    console.error("Error updating stats dashboard:", error);
  }
}

// Save the generated graph
async function saveGraph() {
  try {
    const result = await eel.save_graph()();
    showMessage(result);
  } catch (error) {
    showMessage("Error saving graph: " + error);
  }
}

// Show HTML view
async function showHtmlView() {
  await eel.afficher_html()();
}

// Reset the application
async function resetApplication() {
  loadedFiles = [];
  is3D = false;

  // Reset UI elements
  document.getElementById('numFilesInput').value = "1";
  document.getElementById('manualOffsetCheck').checked = false;
  document.getElementById('autoOffsetCheck').checked = true;
  document.getElementById('offsetValue').value = "0.0";
  document.getElementById('lineType').value = "solid";
  document.getElementById('lineThickness').value = "2";
  document.getElementById('thicknessValue').textContent = "2.0";
  document.getElementById('scaleFactor').value = "1.0";
  document.getElementById('toggle3dBtn').textContent = "Switch to 3D";

  // Disable buttons
  document.getElementById('saveGraphBtn').disabled = true;
  document.getElementById('toggle3dBtn').disabled = true;

  // Clear graph
  document.getElementById('graphImage').classList.add('hidden');
  document.getElementById('noGraphMessage').classList.remove('hidden');

  // Clear color list
  document.getElementById('colorList').innerHTML = '';

  // Reset backend
  await eel.reset_application()();
}

// Toggle offset modes
function toggleOffsetMode() {
  const manualCheck = document.getElementById('manualOffsetCheck');
  const autoCheck = document.getElementById('autoOffsetCheck');

  // Ensure at least one mode is active
  if (!manualCheck.checked && !autoCheck.checked) {
    // If both are unchecked, recheck the one that was just unchecked
    if (event.target.id === 'manualOffsetCheck') {
      manualCheck.checked = true;
    } else {
      autoCheck.checked = true;
    }
    return;
  }

  // Make them mutually exclusive
  if (event.target.id === 'manualOffsetCheck' && manualCheck.checked) {
    autoCheck.checked = false;
  } else if (event.target.id === 'autoOffsetCheck' && autoCheck.checked) {
    manualCheck.checked = false;
  }
}

async function addCustomColor() {
  const colorInput = document.getElementById('customColorInput');
  const color = colorInput.value;

  try {
    const colors = await eel.ajouter_couleur(color)();
    updateColorList(colors);
    // Don't hide the modal so the user can add multiple colors
  } catch (error) {
    showMessage("Error adding color: " + error);
  }
}

// Display a message to the user
function showMessage(message) {
  alert(message);
}

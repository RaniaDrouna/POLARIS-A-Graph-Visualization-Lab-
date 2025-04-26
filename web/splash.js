document.addEventListener('DOMContentLoaded', function() {
  // Add event listener to the "Get Started" button
document.querySelector(".btn").addEventListener("click", function() {
  this.disabled = true; // Disable button after click
  if (window.electronAPI) {
    window.electronAPI.send('launch-main-app');
  } else {
    window.location.href = 'http://localhost:8000/index.html';
  }
});

  // Add a small delay to ensure everything is loaded
  setTimeout(() => {
    console.log("Splash screen fully loaded");
  }, 500);
});
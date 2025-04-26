# main.py
import os
import sys
import eel
import numpy as np
import matplotlib

matplotlib.use('Agg')  # Use non-interactive backend
import matplotlib.pyplot as plt
from scipy.interpolate import griddata
import tkinter as tk
from tkinter import filedialog
import random
import base64
import string
import time

# Initialize Eel
eel.init('web')

# Global state
fichiers = []
couleurs = []
offset_value = 0.0
offset_manual = False
offset_auto = True
scale_factor = 1.0
type_tracage = 'solid'
epaisseur_ligne = 2.0
est_3d = False
azimuth = 45.0
elevation = 30.0


def generate_random_id():
    """Generate a random identifier to prevent image caching."""
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))


@eel.expose
def select_files():
    """Open file dialog and return selected file paths."""
    # Create a hidden tkinter root window
    root = tk.Tk()
    root.withdraw()

    # Show file dialog
    file_paths = filedialog.askopenfilenames(
        title="Select antenna data files",
        filetypes=[("Text Files", "*.txt")]
    )

    # Convert to a list and return
    return list(file_paths)


@eel.expose
def charger_fichiers(file_list):
    """Load the selected files."""
    global fichiers
    if not file_list:
        return "No files selected."
    fichiers = file_list
    return f"{len(fichiers)} file(s) loaded."


# function to get statistics
@eel.expose
def get_graph_stats():
    """Get statistics about the currently loaded data."""
    if not fichiers:
        return {"error": "No files loaded"}

    try:
        stats = []

        for i, fichier in enumerate(fichiers):
            with open(fichier, "r") as f:
                values = [float(l.strip()) for l in f if l.strip()]

            # Apply offsets as needed
            if offset_auto:
                values = appliquer_offset_rotation(values)
            elif offset_manual:
                values = appliquer_offset(values)

            # Calculate statistics
            max_value = max(values)
            max_index = values.index(max_value)
            # Calculate angle in degrees
            angle_degrees = (max_index / len(values)) * 360

            stats.append({
                "file": os.path.basename(fichier),
                "max_gain": max_value,
                "peak_angle": angle_degrees
            })

        return stats
    except Exception as e:
        return {"error": str(e)}

@eel.expose
def ajouter_couleur(couleur):
    """Add a color to the list."""
    global couleurs
    couleurs.append(couleur)
    return couleurs


@eel.expose
def supprimer_couleur(index):
    """Remove a color from the list."""
    global couleurs
    try:
        couleurs.pop(index)
    except IndexError:
        pass
    return couleurs


@eel.expose
def set_params(params):
    """Set plotting parameters."""
    global offset_value, offset_manual, offset_auto, scale_factor, type_tracage, epaisseur_ligne, est_3d
    global azimuth, elevation  # Add these globals

    offset_value = float(params['offset_value'])
    offset_manual = params['offset_manual']
    offset_auto = params['offset_auto']
    scale_factor = float(params['scale_factor'])
    type_tracage = params['type_tracage']
    epaisseur_ligne = float(params['epaisseur_ligne'])
    est_3d = params['est_3d']

    # Add these lines
    if 'azimuth' in params:
        azimuth = float(params['azimuth'])
    if 'elevation' in params:
        elevation = float(params['elevation'])

    return "Parameters updated."

@eel.expose
def generer_graphique():
    """Generate and save the plot."""
    if not fichiers:
        return "Error: No files loaded."

    try:
        # Create figure with appropriate size
        fig = plt.figure(figsize=(10, 8), dpi=100)

        # Set up the axis with the right projection
        if est_3d:
            ax = fig.add_subplot(111, projection='3d')
        else:
            ax = fig.add_subplot(111, projection='polar')

        default_colors = ["red", "blue", "green", "orange", "purple"]

        # Plot each file
        for i, fichier in enumerate(fichiers):
            try:
                # Read the data from the file
                with open(fichier, "r") as f:
                    valeurs = [float(l.strip()) for l in f if l.strip()]

                # Apply offset if necessary
                if offset_auto:
                    valeurs = appliquer_offset_rotation(valeurs)
                elif offset_manual:
                    valeurs = appliquer_offset(valeurs)

                # Get the color (use default if not enough colors defined)
                couleur = couleurs[i] if i < len(couleurs) else default_colors[i % len(default_colors)]

                # Create appropriate plot based on 2D or 3D mode
                if est_3d:
                    tracer_polaire_3d(ax, valeurs, couleur, f"Graph {i + 1}")
                else:
                    tracer_polaire_2d(ax, valeurs, couleur, f"Graph {i + 1}")

            except Exception as e:
                return f"Error processing file {fichier}: {str(e)}"

        # Add legend and labels
        ax.legend()

        # Ensure the assets directory exists
        os.makedirs('web/assets', exist_ok=True)

        # Save the figure
        filename = f"graph_{generate_random_id()}.png"
        filepath = os.path.join("web", "assets", filename)
        fig.savefig(filepath, bbox_inches='tight')
        plt.close(fig)

        return f"assets/{filename}"

    except Exception as e:
        return f"Error generating graph: {str(e)}"


def appliquer_offset(valeurs):
    """Apply manual offset to values."""
    return [v + offset_value for v in valeurs]


def appliquer_offset_rotation(valeurs):
    """Apply automatic offset and rotation to values."""
    if not valeurs:
        return []

    val_max = max(valeurs)  # Find maximum value
    offset = -val_max  # Calculate offset to center the graph

    valeurs_offset = [v + offset for v in valeurs]  # Apply offset to all values

    # For rotation, we want the new max value to always be at 0°
    idx_max = valeurs_offset.index(0)  # Find where the max value became 0
    valeurs_offset = valeurs_offset[idx_max:] + valeurs_offset[:idx_max]  # Perform rotation

    return valeurs_offset


def tracer_polaire_2d(ax, valeurs, couleur, label):
    """Create a 2D polar plot."""
    theta = np.linspace(0, 2 * np.pi, len(valeurs))
    r = np.array(valeurs) * scale_factor
    ax.plot(theta, r, color=couleur, label=label, linestyle=type_tracage, linewidth=epaisseur_ligne)


def tracer_polaire_3d(ax, valeurs, couleur, label):
    """Create a 3D surface plot from polar data."""
    # Set the view angles
    ax.view_init(elev=elevation, azim=azimuth)

    # Rest of the function remains the same
    angles = np.linspace(0, 2 * np.pi, len(valeurs))
    r = np.array(valeurs) * scale_factor

    # Convert polar to cartesian coordinates
    x = r * np.cos(angles)
    y = r * np.sin(angles)
    z = r

    # Create a regular grid for interpolation
    grid_x, grid_y = np.mgrid[min(x):max(x):100j, min(y):max(y):100j]
    grid_z = griddata((x, y), z, (grid_x, grid_y), method='cubic')

    # Display the smoothed surface
    surf = ax.plot_surface(grid_x, grid_y, grid_z, cmap='plasma', edgecolor='none', alpha=0.9)
    ax.set_title(label)

    # Add a color bar
    plt.colorbar(surf, ax=ax, shrink=0.5, aspect=5)

@eel.expose
def save_graph():
    """Save the current graph to a file."""
    try:
        # Create a hidden tkinter root window
        root = tk.Tk()
        root.withdraw()

        # Show save file dialog
        file_path = filedialog.asksaveasfilename(
            defaultextension=".png",
            filetypes=[("PNG", "*.png"), ("JPEG", "*.jpg")]
        )

        if not file_path:
            return "Save cancelled."

        # Get the most recently generated graph
        latest_graph = None
        assets_dir = os.path.join("web", "assets")
        if os.path.exists(assets_dir):
            graph_files = [f for f in os.listdir(assets_dir) if f.startswith("graph_") and f.endswith(".png")]
            if graph_files:
                # Sort by modification time (most recent first)
                graph_files.sort(key=lambda f: os.path.getmtime(os.path.join(assets_dir, f)), reverse=True)
                latest_graph = os.path.join(assets_dir, graph_files[0])

        if not latest_graph:
            return "No graph available to save."

        # Save the graph
        fig = plt.figure(figsize=(10, 8), dpi=100)

        # Set up the axis with the right projection
        if est_3d:
            ax = fig.add_subplot(111, projection='3d')
        else:
            ax = fig.add_subplot(111, projection='polar')

        # Recreate the plot for the selected save location
        for i, fichier in enumerate(fichiers):
            with open(fichier, "r") as f:
                valeurs = [float(l.strip()) for l in f if l.strip()]

            if offset_auto:
                valeurs = appliquer_offset_rotation(valeurs)
            elif offset_manual:
                valeurs = appliquer_offset(valeurs)

            couleur = couleurs[i] if i < len(couleurs) else ["red", "blue", "green", "orange", "purple"][i % 5]

            if est_3d:
                tracer_polaire_3d(ax, valeurs, couleur, f"Graph {i + 1}")
            else:
                tracer_polaire_2d(ax, valeurs, couleur, f"Graph {i + 1}")

        ax.legend()
        fig.savefig(file_path, bbox_inches='tight')
        plt.close(fig)

        return f"Graph saved to {file_path}"

    except Exception as e:
        return f"Error saving graph: {str(e)}"


@eel.expose
def reset_application():
    """Reset all application state."""
    global fichiers, couleurs, offset_value, offset_manual, offset_auto, scale_factor, type_tracage, epaisseur_ligne, est_3d

    fichiers = []
    couleurs = []
    offset_value = 0.0
    offset_manual = False
    offset_auto = True
    scale_factor = 1.0
    type_tracage = 'solid'
    epaisseur_ligne = 2.0
    est_3d = False

    return "Application reset."


@eel.expose
def get_data_preview(file_path):
    """Get a preview summary of the data in a file."""
    try:
        with open(file_path, "r") as f:
            values = [float(l.strip()) for l in f if l.strip()]

        if not values:
            return {"error": "No valid data in file"}

        return {
            "file_name": os.path.basename(file_path),
            "points": len(values),
            "min": min(values),
            "max": max(values),
            "mean": sum(values) / len(values),
            "sample": values[:5] + (["..."] if len(values) > 5 else [])
        }
    except Exception as e:
        return {"error": f"Error processing file: {str(e)}"}

@eel.expose
def afficher_html():
    """Show HTML information."""
    return "HTML view displayed."


if __name__ == '__main__':
    # Create assets directory if it doesn't exist
    if not os.path.exists('web/assets'):
        os.makedirs('web/assets')

    # Don't start electron from Python side
    # Just start the Eel web server
    port = 8000
    # Change mode to 'custom' instead of 'electron'
    eel.start('index.html', mode='electron', host='localhost', port=port, block=True)


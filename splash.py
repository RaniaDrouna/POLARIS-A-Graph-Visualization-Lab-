import eel
import os
import subprocess
import shutil

eel.init("web")  # web/splashIndex.html must be in the web folder

# Set Eel to use Electron
electron_path = shutil.which("electron")
if electron_path is None:
    raise Exception("Electron not found. Please make sure it is installed.")
os.environ["EEL_ELECTRON_PATH"] = electron_path

@eel.expose
def launch_main_app():
    print("🚀 Launching main app via Python...")
    eel.close_window()
    subprocess.Popen(["python", "main.py"])  # Launch main.py directly

eel.start("splashIndex.html", mode="electron", port=8001, size=(600, 400))

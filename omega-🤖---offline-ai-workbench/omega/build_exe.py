"""
OMEGA AI Workbench - PyInstaller Standalone Windows Executable Builder
Compiles OMEGA into a self-contained Windows desktop executable (.exe).

Usage:
    pip install pyinstaller
    python build_exe.py
"""
import os
import sys
import subprocess
import shutil

def build():
    print("==================================================")
    print("   BUILDING OMEGA STANDALONE WINDOWS EXECUTABLE   ")
    print("==================================================")

    current_dir = os.path.dirname(os.path.abspath(__file__))
    dist_dir = os.path.join(current_dir, "dist")
    build_dir = os.path.join(current_dir, "build")

    # Locate streamlit static and runtime assets
    import streamlit
    streamlit_path = os.path.dirname(streamlit.__file__)
    static_assets = os.path.join(streamlit_path, "static")

    # Files and folders to bundle
    app_py = os.path.join(current_dir, "app.py")
    backend_dir = os.path.join(current_dir, "backend")
    utils_dir = os.path.join(current_dir, "utils")

    # PyInstaller arguments
    cmd = [
        sys.executable,
        "-m", "PyInstaller",
        "--noconfirm",
        "--onedir",                # Single folder distribution (most stable for ChromaDB/Streamlit)
        "--windowed",              # No persistent black console window
        "--name", "OMEGA",
        # Data files
        f"--add-data={app_py};.",
        f"--add-data={backend_dir};backend",
        f"--add-data={utils_dir};utils",
        f"--add-data={static_assets};streamlit/static",
        # Hidden imports required by dynamic imports in Streamlit, ChromaDB, PyMuPDF, python-docx
        "--hidden-import=streamlit",
        "--hidden-import=streamlit.web.cli",
        "--hidden-import=chromadb",
        "--hidden-import=chromadb.config",
        "--hidden-import=chromadb.telemetry.posthog",
        "--hidden-import=fitz",
        "--hidden-import=docx",
        "--hidden-import=requests",
        "--hidden-import=PIL",
        "--hidden-import=PIL.Image",
        "--hidden-import=numpy",
        "--hidden-import=pandas",
        "--hidden-import=altair",
        "--hidden-import=pyarrow",
        "run_desktop.py"
    ]

    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=current_dir)

    if result.returncode == 0:
        print("\n==================================================")
        print("✅ SUCCESS! Standalone OMEGA application built!")
        print(f"Output folder: {os.path.join(dist_dir, 'OMEGA')}")
        print(f"Executable:    {os.path.join(dist_dir, 'OMEGA', 'OMEGA.exe')}")
        print("==================================================")
    else:
        print(f"\n❌ Build failed with exit code {result.returncode}")

if __name__ == "__main__":
    build()

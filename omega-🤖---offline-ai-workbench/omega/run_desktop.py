"""
OMEGA AI Workbench - Desktop Runner
Entry point for packaging OMEGA as a standalone Windows desktop executable (.exe).
Boots the local Streamlit server headless and automatically opens the user's browser.
"""
import sys
import os
import time
import webbrowser
import threading
from streamlit.web import cli as stcli

def open_browser():
    """Waits for Streamlit server to bind, then opens localhost in browser."""
    time.sleep(2.0)
    webbrowser.open("http://localhost:8501")

def main():
    # Resolve directory paths whether running as script or frozen PyInstaller executable
    if getattr(sys, 'frozen', False):
        base_dir = sys._MEIPASS
    else:
        base_dir = os.path.dirname(os.path.abspath(__file__))

    app_path = os.path.join(base_dir, "app.py")

    # Set environment variables for clean local offline execution
    os.environ["STREAMLIT_SERVER_HEADLESS"] = "true"
    os.environ["STREAMLIT_GLOBAL_DEVELOPMENT_MODE"] = "false"
    os.environ["STREAMLIT_SERVER_ENABLE_CORS"] = "false"
    os.environ["STREAMLIT_SERVER_ENABLE_XSRF_PROTECTION"] = "false"

    # Launch browser thread
    threading.Thread(target=open_browser, daemon=True).start()

    # Pass command line arguments to Streamlit
    sys.argv = [
        "streamlit",
        "run",
        app_path,
        "--global.developmentMode=false",
        "--server.port=8501",
        "--server.headless=true",
        "--browser.serverAddress=localhost",
        "--theme.base=dark",
        "--theme.backgroundColor=#070B14",
        "--theme.secondaryBackgroundColor=#0B1120",
        "--theme.textColor=#E2E8F0",
        "--theme.primaryColor=#3B82F6"
    ]
    sys.exit(stcli.main())

if __name__ == "__main__":
    main()

@echo off
title OMEGA AI Workbench - Local Offline Launcher
color 0B
cls

echo =======================================================
echo          OMEGA 🤖 - OFFLINE AI WORKBENCH
echo   Secure, sovereign, and offline AI workspace.
echo =======================================================
echo.

:: 1. Check if Ollama is running on port 11434
echo [1/3] Checking local Ollama service...
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARNING] Ollama does not seem to be running on localhost:11434.
    echo Attempting to start Ollama in the background...
    start "" ollama serve
    timeout /t 3 /nobreak >nul
) else (
    echo [OK] Ollama is active on http://localhost:11434
)

:: 2. Check virtual environment
echo.
echo [2/3] Checking Python environment...
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
) else (
    echo Virtual environment not found. Using system Python...
)

:: 3. Run Streamlit Application
echo.
echo [3/3] Launching OMEGA Workbench...
echo Starting Streamlit interface on port 8501...
streamlit run app.py --theme.base=dark --theme.backgroundColor=#070B14 --theme.secondaryBackgroundColor=#0B1120 --theme.primaryColor=#3B82F6

pause

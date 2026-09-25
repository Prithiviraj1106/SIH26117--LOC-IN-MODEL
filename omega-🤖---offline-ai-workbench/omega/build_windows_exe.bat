@echo off
title Build OMEGA Standalone Windows .EXE
color 0A
cls

echo =======================================================
echo     BUILDING OMEGA STANDALONE WINDOWS EXECUTABLE
echo =======================================================
echo.

:: Check python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in your PATH.
    pause
    exit /b 1
)

echo [1/3] Installing requirements & PyInstaller...
pip install -r requirements.txt
pip install pyinstaller

echo.
echo [2/3] Compiling OMEGA desktop executable...
python build_exe.py

echo.
echo [3/3] Build complete!
if exist dist\OMEGA\OMEGA.exe (
    echo [SUCCESS] OMEGA.exe has been generated in:
    echo %cd%\dist\OMEGA\OMEGA.exe
    echo.
    echo You can distribute the dist\OMEGA folder or create a desktop shortcut.
) else (
    echo [WARNING] Please review the console output for any build warnings.
)

pause

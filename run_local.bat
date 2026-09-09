@echo off
title SIH-26143 Maritime Domain Awareness - Localhost Server
echo =====================================================================
echo    SIH-26143: National Maritime Domain Awareness (Localhost)
echo    Satellite SAR Oil Spill Detection, Drift & AIS Attribution
echo =====================================================================
echo.

cd /d "%~dp0"

REM Activate virtual environment if available
if exist "venv\Scripts\activate.bat" (
    echo [*] Activating local virtual environment (venv)...
    call venv\Scripts\activate.bat
) else (
    echo [!] Warning: venv\Scripts\activate.bat not found. Using system Python.
)

echo [*] Starting Uvicorn Local Server on http://localhost:8000 ...
echo [*] Web Dashboard automatically mounted at http://localhost:8000
echo [*] Hardware Acceleration: NVIDIA GPU / CUDA Active
echo.
echo Press Ctrl+C anytime to stop the server.
echo.

REM Automatically open browser after 2 seconds
start "" http://localhost:8000

REM Launch Uvicorn
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

pause

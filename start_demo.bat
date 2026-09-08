@echo off
echo ================================================================
echo STARTING SIH26143 MARITIME OIL SPILL SURVEILLANCE SYSTEM
echo ================================================================

echo 1. Starting FastAPI Backend on http://localhost:8000...
start "SIH26143-API-BACKEND" cmd /k "python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 2 >nul

echo 2. Starting Frontend Tactical Web Dashboard on http://localhost:5173...
cd frontend
start "SIH26143-WEB-FRONTEND" cmd /k "npm run dev"

echo.
echo ================================================================
echo SYSTEM RUNNING!
echo - FastAPI Backend: http://localhost:8000
echo - Swagger Docs:    http://localhost:8000/docs
echo - Web Dashboard:   http://localhost:5173
echo ================================================================


# SIH-26143 Localhost Runner Script
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host "   SIH-26143: National Maritime Domain Awareness (Localhost)" -ForegroundColor Cyan
Write-Host "   Satellite SAR Oil Spill Detection, Drift & AIS Attribution" -ForegroundColor Cyan
Write-Host "=====================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Activate venv if present
$VenvActivate = Join-Path $ScriptDir "venv\Scripts\Activate.ps1"
if (Test-Path $VenvActivate) {
    Write-Host "[*] Activating Python Virtual Environment..." -ForegroundColor Green
    & $VenvActivate
}

Write-Host "[*] Launching Uvicorn on http://localhost:8000 ..." -ForegroundColor Green
Write-Host "[*] Opening browser at http://localhost:8000" -ForegroundColor Green
Write-Host ""

# Start browser
Start-Process "http://localhost:8000"

# Run Uvicorn
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

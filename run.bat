@echo off
setlocal

cd /d "%~dp0"
set PORT=4173
set URL=http://127.0.0.1:%PORT%/

where py >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" "%URL%"
  py -m http.server %PORT% --bind 127.0.0.1
  exit /b %ERRORLEVEL%
)

where python >nul 2>nul
if %ERRORLEVEL%==0 (
  start "" "%URL%"
  python -m http.server %PORT% --bind 127.0.0.1
  exit /b %ERRORLEVEL%
)

echo Python was not found. Install Python or run: python -m http.server %PORT%
pause
exit /b 1

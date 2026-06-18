@echo off
cd /d "%~dp0"
echo === J.A.R.V.I.S. ===
echo Building...
node build.cjs
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)
echo Launching...
node_modules\electron\dist\electron.exe . --no-sandbox --enable-unsafe-swiftshader
if errorlevel 1 (
    echo Exited with error code %errorlevel%
    pause
)

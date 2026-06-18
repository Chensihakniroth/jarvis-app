@echo off
cd /d "%~dp0"
echo === J.A.R.V.I.S. Launcher ===

:: Copy esbuild if missing
if not exist "node_modules\esbuild\package.json" (
    echo [Setup] Copying esbuild from workspace...
    if exist "D:\School\PROJECT\anakot-agent\node_modules\vite\node_modules\esbuild" (
        if not exist "node_modules\esbuild" mkdir node_modules\esbuild
        xcopy /E /I /Y "D:\School\PROJECT\anakot-agent\node_modules\vite\node_modules\esbuild\*" "node_modules\esbuild\"
        if not exist "node_modules\@esbuild" mkdir node_modules\@esbuild
        if not exist "node_modules\@esbuild\win32-x64" mkdir node_modules\@esbuild\win32-x64
        xcopy /E /I /Y "D:\School\PROJECT\anakot-agent\node_modules\vite\node_modules\@esbuild\win32-x64\*" "node_modules\@esbuild\win32-x64\"
    ) else (
        echo [Error] esbuild not found!
        pause
        exit /b 1
    )
)

:: Build
echo [Build] Building...
node build.cjs
if errorlevel 1 (
    echo [Error] Build failed!
    pause
    exit /b 1
)

:: Launch
echo [Launch] Starting J.A.R.V.I.S...
node_modules\electron\electron.exe . --no-sandbox --enable-unsafe-swiftshader

echo.
echo [Done] Electron exited with code: %errorlevel%
pause
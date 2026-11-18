@echo off
cd /d "%~dp0"
title TACTICAL MAP WARGAME
echo.
echo   TACTICAL MAP WARGAME - launcher
echo   ---------------------------------
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   [ERROR] Node.js not found.
  echo   Please install Node.js 18+ from https://nodejs.org/ and run again.
  echo.
  pause
  exit /b 1
)

if not exist "app\dist\index.html" (
  echo   First run: building front-end, please wait...
  pushd app
  where pnpm >nul 2>nul
  if errorlevel 1 (
    call npm install
    call npm run build
  ) else (
    call pnpm install
    call pnpm build
  )
  popd
  echo.
)

node "Tools\serve.mjs"
if errorlevel 1 (
  echo.
  echo   Server exited with an error.
  pause
)

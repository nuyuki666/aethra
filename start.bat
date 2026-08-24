@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Aethra - сервер
set "PORT=5177"

echo ==========================================
echo    Aethra - локальный сервер
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ОШИБКА] Node.js не найден.
  echo.
  echo Установите его с https://nodejs.org/ и перезапустите этот файл.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\express" (
  echo Первый запуск: устанавливаю зависимости ^(npm install^)...
  call npm install
  if errorlevel 1 (
    echo [ОШИБКА] npm install завершился с ошибкой.
    pause
    exit /b 1
  )
  echo.
)

echo Адрес:  http://localhost:%PORT%
echo Остановить - закройте это окно или нажмите Ctrl+C.
echo.

start "" /min cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:%PORT%/index.html"

node server.js

echo.
echo Сервер остановлен.
pause

@echo off
chcp 65001 > nul
REM Сборка агента и конфигуратора DreamBar (Windows).
REM Запускать на Windows-машине:
REM   py -m pip install -r requirements.txt
REM   build.bat

echo Сборка dreambar-print-agent.exe...
pyinstaller --onefile --name dreambar-print-agent ^
    --hidden-import win32print ^
    --hidden-import win32timezone ^
    agent.py

echo.
echo Сборка dreambar-setup.exe (конфигуратор)...
pyinstaller --onefile --name dreambar-setup ^
    --windowed ^
    setup_gui.py

echo.
echo Готово:
echo   dist\dreambar-print-agent.exe  — агент (запускать в фоне / через службу)
echo   dist\dreambar-setup.exe        — конфигуратор (GUI для настройки и запуска)
echo.
echo Положите оба файла + config.ini в одну папку на кассовом ПК.
echo Для установки как службы: install\install-windows.bat (требует NSSM)

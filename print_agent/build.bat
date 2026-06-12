@echo off
chcp 65001 > nul
REM Сборка агента и конфигуратора DreamBar (Windows).
REM Запускать на Windows-машине:
REM   py -m pip install -r requirements.txt
REM   build.bat

REM Если рядом лежит libfptr10.py (обёртка Драйвера ККТ 10 АТОЛ, для mode=atol) —
REM вшиваем его в .exe, тогда на кассовом ПК отдельный файл не нужен.
set ATOL_OPTS=
if exist libfptr10.py (
    set ATOL_OPTS=--hidden-import libfptr10
    echo Найден libfptr10.py — будет вшит в агента.
)

echo Сборка dreambar-print-agent.exe...
pyinstaller --onefile --name dreambar-print-agent ^
    --hidden-import win32print ^
    --hidden-import win32timezone ^
    %ATOL_OPTS% ^
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

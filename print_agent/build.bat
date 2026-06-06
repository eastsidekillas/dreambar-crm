@echo off
REM Сборка одного исполняемого файла dreambar-print-agent.exe (Windows).
REM Запускать на Windows-машине: py -m pip install -r requirements.txt, затем build.bat

pyinstaller --onefile --name dreambar-print-agent ^
    --hidden-import win32print ^
    --hidden-import win32timezone ^
    agent.py

echo.
echo Готово: dist\dreambar-print-agent.exe
echo Положите рядом config.ini (см. config.ini.example) и запускайте.
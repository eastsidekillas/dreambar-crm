@echo off
REM Установка DreamBar Print Agent как службы Windows через NSSM.
REM
REM Требования:
REM   1. Скачайте NSSM (https://nssm.cc/download) и положите nssm.exe в эту папку.
REM   2. Запустите этот скрипт от имени Администратора.
REM   3. Убедитесь, что dreambar-print-agent.exe и config.ini находятся в папке выше.
REM
REM Для удаления службы:
REM   nssm remove DreamBarPrintAgent confirm

set SCRIPT_DIR=%~dp0
set AGENT_DIR=%SCRIPT_DIR%..
set AGENT_EXE=%AGENT_DIR%dreambar-print-agent.exe
set NSSM=%SCRIPT_DIR%nssm.exe

if not exist "%NSSM%" (
    echo ОШИБКА: nssm.exe не найден в %SCRIPT_DIR%
    echo Скачайте NSSM с https://nssm.cc/download и положите nssm.exe рядом с этим файлом.
    pause
    exit /b 1
)

if not exist "%AGENT_EXE%" (
    echo ОШИБКА: dreambar-print-agent.exe не найден в %AGENT_DIR%
    echo Соберите агент командой build.bat или скопируйте готовый .exe.
    pause
    exit /b 1
)

echo Устанавливаем службу DreamBarPrintAgent...

"%NSSM%" install DreamBarPrintAgent "%AGENT_EXE%"
"%NSSM%" set DreamBarPrintAgent AppDirectory "%AGENT_DIR%"
"%NSSM%" set DreamBarPrintAgent DisplayName "DreamBar Print Agent"
"%NSSM%" set DreamBarPrintAgent Description "Агент печати DreamBar — опрашивает backend и печатает чеки на кассовом принтере"
"%NSSM%" set DreamBarPrintAgent Start SERVICE_AUTO_START
"%NSSM%" set DreamBarPrintAgent AppStdout "%AGENT_DIR%agent.log"
"%NSSM%" set DreamBarPrintAgent AppStderr "%AGENT_DIR%agent.log"
"%NSSM%" set DreamBarPrintAgent AppRotateFiles 1
"%NSSM%" set DreamBarPrintAgent AppRotateBytes 1048576

echo Запускаем службу...
"%NSSM%" start DreamBarPrintAgent

echo.
echo Готово! Служба DreamBarPrintAgent установлена и запущена.
echo Управление: services.msc или nssm (start/stop/remove DreamBarPrintAgent)
echo Логи: %AGENT_DIR%agent.log
pause

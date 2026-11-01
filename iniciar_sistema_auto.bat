@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Servidor Gestao Comercial

cls
echo ================================================
echo              GESTAO COMERCIAL
echo ================================================
echo.

if not exist "Python\app.py" (
    echo ERRO: nao encontrei Python\app.py.
    echo Deixe este arquivo .bat na pasta principal do sistema.
    echo.
    pause
    exit /b 1
)

where py >nul 2>nul
if errorlevel 1 (
    echo ERRO: o comando py nao foi encontrado.
    echo Verifique a instalacao do Python.
    echo.
    pause
    exit /b 1
)

echo Iniciando o servidor...
echo O navegador sera aberto automaticamente quando o servidor responder.
echo.

start "" /b powershell -NoProfile -WindowStyle Hidden -Command "$url='http://127.0.0.1:8000'; for($i=0; $i -lt 60; $i++){ try { $c=New-Object System.Net.Sockets.TcpClient; $ar=$c.BeginConnect('127.0.0.1',8000,$null,$null); if($ar.AsyncWaitHandle.WaitOne(300)){ $c.EndConnect($ar); $c.Close(); Start-Process $url; exit } $c.Close() } catch {} ; Start-Sleep -Milliseconds 500 }; Start-Process $url"

py -3 "Python\app.py"

echo.
echo O servidor foi encerrado.
pause

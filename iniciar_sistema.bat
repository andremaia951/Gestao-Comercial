@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Varejo+ - Servidor local
cls
echo ======================================================
echo                    VAREJO+
echo                GESTAO DA LOJA
echo ======================================================
echo.
if not exist "Python\app.py" (
  echo ERRO: nao encontrei Python\app.py.
  echo Coloque este arquivo .bat na pasta principal do projeto.
  echo.
  pause
  exit /b 1
)
where py >nul 2>nul
if errorlevel 1 (
  echo ERRO: comando py nao encontrado. Verifique a instalacao do Python.
  echo.
  pause
  exit /b 1
)
echo Iniciando o servidor local...
echo O navegador sera aberto quando o sistema responder.
echo.
start "" /b powershell -NoProfile -WindowStyle Hidden -Command "$u='http://127.0.0.1:8000'; for($i=0;$i -lt 50;$i++){try{$r=Invoke-WebRequest -UseBasicParsing -Uri ($u+'/api/health') -TimeoutSec 2;if($r.StatusCode -eq 200){Start-Process $u;exit}}catch{};Start-Sleep -Milliseconds 500}; Start-Process $u"
py -3 "Python\app.py"
echo.
echo O servidor foi encerrado.
pause

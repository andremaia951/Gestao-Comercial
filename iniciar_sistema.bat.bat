@echo off
setlocal
cd /d "%~dp0"
title Servidor Gestao Comercial

 echo ============================================
 echo          GESTAO COMERCIAL
 echo ============================================
 echo.

where py >nul 2>&1
if errorlevel 1 (
    echo ERRO: O inicializador Python 'py' nao foi encontrado.
    echo Verifique a instalacao do Python.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0Python\app.py" (
    echo ERRO: Nao encontrei o arquivo Python\app.py.
    echo Este BAT precisa ficar na pasta principal do Gestao Comercial.
    echo.
    pause
    exit /b 1
)

echo Iniciando o servidor...
echo Quando aparecer o endereco abaixo, abra no navegador:
echo http://127.0.0.1:8000
 echo.
py -3 "%~dp0Python\app.py"

set "resultado=%errorlevel%"
echo.
if not "%resultado%"=="0" (
    echo O servidor terminou com codigo de erro %resultado%.
) else (
    echo O servidor foi encerrado.
)
echo.
pause
endlocal

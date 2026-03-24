@echo off
setlocal enabledelayedexpansion
title MedDoc - Instalacao Final

echo.
echo ============================================================
echo           MedDoc - Preparando Frontend + Servidor
echo ============================================================
echo.

set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm;%ProgramFiles%\nodejs"

echo [1/4] Instalando dependencias do Frontend e do Servidor...
:: Adicionamos express, cors e dotenv que sao o coracao do server.cjs
call npm install react-router-dom react-hot-toast date-fns axios react-dropzone framer-motion express cors dotenv --save

echo.
echo [2/4] Verificando integridade dos pacotes...
call npm install

echo.
echo [3/4] Testando Build do Vite...
call npm run build
if %errorlevel% neq 0 (
    echo ERRO na compilacao! Verifique o log.
    pause
    exit /b 1
)

echo.
echo [4/4] Enviando atualizacoes para o GitHub...
:: Isso automatiza o envio para voce nao esquecer nada
git add .
git commit -m "fix: adiciona dependencias do servidor express e cors"
git push

echo.
echo ============================================================
echo  TUDO PRONTO!
echo  O Render vai detectar o Push e iniciar o Deploy.
echo  Lembre-se de usar "Clear Cache and Deploy" no painel Render.
echo ============================================================
echo.
pause

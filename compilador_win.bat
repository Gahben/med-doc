@echo off
setlocal enabledelayedexpansion
title MedDoc - Instalacao e Deploy Customizado

echo.
echo ============================================================
echo           MedDoc - Gestao de Build e Deploy
echo ============================================================
echo.

:: Configuração de PATH para garantir que o Node seja encontrado
set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm;%ProgramFiles%\nodejs"

echo [1/5] Verificando ambiente Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ERRO: Node.js nao encontrado no sistema!
    echo Certifique-se de que o Node.js esta instalado e no PATH.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo Versao encontrada: %NODE_VER% - OK!

echo.
echo [2/5] Instalando dependencias (Frontend + Servidor)...
:: Adicionamos todos os pacotes cruciais para evitar erros de import
call npm install react-router-dom react-hot-toast date-fns axios react-dropzone framer-motion express cors dotenv --save

echo.
echo [3/5] Verificando integridade e pacotes adicionais...
call npm install

echo.
echo [4/5] Executando Build do Vite (Producao)...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERRO CRITICO na compilacao do Vite! Verifique o log acima.
    pause
    exit /b 1
)
echo Build concluido com sucesso na pasta /dist!

echo.
echo [5/5] Preparando envio para o GitHub...
set /p COMMIT_MSG="Digite a descricao do seu commit (ou aperte Enter para padrao): "

if "%COMMIT_MSG%"=="" (
    set COMMIT_MSG="fix: ajustes gerais de build e dependencias"
)

echo.
echo Enviando para o repositorio remoto...
git add .
git commit -m "%COMMIT_MSG%"
git push

echo.
echo ============================================================
echo  PROCESSO CONCLUIDO COM SUCESSO!
echo  Mensagem do commit: %COMMIT_MSG%
echo.
echo  Va ao painel do Render e use:
echo  Manual Deploy -> "Clear Cache and Deploy"
echo ============================================================
echo.
pause

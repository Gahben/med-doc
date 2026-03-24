@echo off
setlocal enabledelayedexpansion
title MedDoc - Instalacao do Sistema

echo.
echo ============================================================
echo           MedDoc - Instalacao e Configuracao
echo ============================================================
echo.

set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm;%ProgramFiles%\nodejs"

echo [1/4] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao encontrado! Instale em nodejs.org
    pause
    exit /b 1
)

echo [2/4] Instalando pacotes (Frontend + Servidor)...
call npm install react-router-dom react-hot-toast date-fns axios react-dropzone framer-motion express cors --save

echo.
echo [3/4] Atualizando dependencias gerais...
call npm install
if %errorlevel% neq 0 (
    echo ERRO ao instalar dependencias!
    pause
    exit /b 1
)

echo.
echo [4/4] Testando Build do Vite...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ERRO na compilacao!
    echo Verifique se o erro mudou para outro nome de biblioteca.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  SUCESSO! O frontend foi compilado sem erros.
echo  Agora voce pode fazer o GIT PUSH para o Render.
echo ============================================================
echo.
pause

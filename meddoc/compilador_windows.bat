@echo off
title MedDoc - Preparacao para Deploy

echo.
echo ============================================================
echo    MedDoc - Preparacao para Deploy no Render
echo ============================================================
echo.

REM Adicionar caminhos do Node.js ao PATH
set "PATH=%PATH%;C:\Program Files\nodejs;%APPDATA%\npm"

echo [Passo 1/4] Verificando Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  ERRO: Node.js nao encontrado!
    echo  Baixe em: https://nodejs.org
    echo  Instale, REINICIE e execute novamente.
    echo.
    pause
    exit /b 1
)
for /f %%i in ('node --version') do echo  Node.js %%i encontrado!

echo.
echo [Passo 2/4] Limpando cache anterior...
if exist .next (
    echo  Removendo pasta .next...
    rmdir /s /q .next
)

echo.
echo [Passo 3/4] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo  ERRO ao instalar dependencias!
    pause
    exit /b 1
)
echo  Dependencias instaladas!

echo.
echo [Passo 4/4] Compilando o projeto (build)...
call npm run build
if %errorlevel% neq 0 (
    echo  ERRO ao compilar o projeto!
    echo.
    echo  Verifique os erros acima antes de fazer push.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo  Build local concluido com sucesso!
echo  Agora voce pode fazer push para o GitHub:
echo.
echo    git add .
echo    git commit -m "sua mensagem"
echo    git push origin main
echo ============================================================
echo.
pause

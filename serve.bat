@echo off
chcp 65001 >nul
title Arabesco - Servidor local
echo.
echo  ============================================
echo    ARABESCO - servidor local iniciado
echo    Abrindo: http://localhost:8080
echo    (Cache desativado - edicoes aparecem na hora)
echo  ============================================
echo.
start http://localhost:8080
python "%~dp0tools\dev_server.py"

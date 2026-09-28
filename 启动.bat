@echo off
chcp 936 >nul
title 我的全景漫游
cd /d "%~dp0"

rem 找可用的 Python 命令
set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY where py >nul 2>nul && set "PY=py"

if not defined PY (
    echo [错误] 没有找到 Python，请先安装 Python 3：https://www.python.org/downloads/
    echo 安装时勾选 "Add Python to PATH"。
    pause
    exit /b 1
)

echo 正在启动本地服务，请勿关闭本窗口（关闭即停止服务）。
echo 漫游页面： http://localhost:8000/
echo 编辑器：   http://localhost:8000/editor.html
start "" "http://localhost:8000/index.html"
%PY% -m http.server 8000
pause

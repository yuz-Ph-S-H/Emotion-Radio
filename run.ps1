# 共感电台 Emotion Radio 启动脚本 (PowerShell)
# 用法：在项目目录执行 .\run.ps1
$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot
$OutputEncoding = [System.Text.Encoding]::UTF8

$python = Join-Path $PSScriptRoot "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    Write-Host "未找到虚拟环境 $python" -ForegroundColor Red
    Write-Host "请先创建并安装依赖：python -m venv venv ; .\venv\Scripts\pip install -r requirements.txt"
    exit 1
}

$busy = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($busy) {
    Write-Host "端口 5000 已被占用，正在清理旧进程..." -ForegroundColor Yellow
    $busy | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  共感电台 Emotion Radio - 启动中..." -ForegroundColor Cyan
Write-Host "  浏览器将自动打开 http://127.0.0.1:5000"
Write-Host "  进入页面后先点击一下页面，再发送文字才有声音"
Write-Host "  按 Ctrl+C 停止服务器"
Write-Host "============================================" -ForegroundColor Cyan

Start-Job -ScriptBlock { Start-Sleep -Seconds 3; Start-Process "http://127.0.0.1:5000" } | Out-Null

& $python -X utf8 -c "import app; app.socketio.run(app.app, host='127.0.0.1', port=5000, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)"

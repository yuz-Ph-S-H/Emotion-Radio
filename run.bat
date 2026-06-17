@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   共感电台 Emotion Radio - 启动中...
echo   启动后请用浏览器打开 http://127.0.0.1:5000
echo   进入页面后先点击一下页面再发送文字才有声音
echo   按 Ctrl+C 可停止服务器
echo ============================================
echo.

REM 启动 3 秒后自动打开浏览器
start "" /b cmd /c "timeout /t 3 >nul & start http://127.0.0.1:5000"

".\venv\Scripts\python.exe" -X utf8 -c "import app; app.socketio.run(app.app, host='127.0.0.1', port=5000, debug=False, use_reloader=False, allow_unsafe_werkzeug=True)"

echo.
echo 服务器已停止。
pause

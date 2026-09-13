@echo off
REM TubeGratis - abre la app con descarga directa (uso personal)
REM Inicia el servidor local y abre el navegador en el.
cd /d "%~dp0"
python -m pip install -q yt-dlp 2>nul
start "" "http://localhost:8765"
python servidor.py
pause

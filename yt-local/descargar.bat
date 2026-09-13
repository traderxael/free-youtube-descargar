@echo off
REM TubeGratis - Descargador local gratis (usa yt-dlp de GitHub)
REM Repo: https://github.com/yt-dlp/yt-dlp
if not exist yt-dlp.exe (
  echo Descargando yt-dlp.exe gratis desde GitHub...
  powershell -Command "Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile 'yt-dlp.exe'"
)
:loop
set /p URL="Pega el link de YouTube (o ENTER para salir): "
if "%URL%"=="" goto end
echo 1. Video MP4 (720p)
echo 2. Video MP4 (maxima)
echo 3. Solo audio MP3
set /p OP="Elige 1/2/3: "
if "%OP%"=="3" (
  yt-dlp.exe "%URL%" -x --audio-format mp3 -o "%%(title)s.%%(ext)s"
) else if "%OP%"=="2" (
  yt-dlp.exe "%URL%" -f "bv*+ba/best" --merge-output-format mp4 -o "%%(title)s.%%(ext)s"
) else (
  yt-dlp.exe "%URL%" -f "bv*[height<=720]+ba/best" --merge-output-format mp4 -o "%%(title)s.%%(ext)s"
)
echo.
echo Listo. El archivo quedo en esta carpeta. Puedes abrirlo con doble clic para reproducirlo.
echo.
goto loop
:end
pause

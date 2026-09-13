# TubeGratis - Descargador local gratis (PowerShell)
# Repo GitHub: https://github.com/yt-dlp/yt-dlp
# Uso: right-click > Ejecutar con PowerShell, o: powershell -ExecutionPolicy Bypass -File descargar.ps1
if (-not (Test-Path ".\yt-dlp.exe")) {
  Write-Host "Descargando yt-dlp.exe desde GitHub..." -ForegroundColor Green
  Invoke-WebRequest -Uri 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' -OutFile '.\yt-dlp.exe'
}
while ($true) {
  $url = Read-Host "Pega el link de YouTube (ENTER para salir)"
  if ([string]::IsNullOrWhiteSpace($url)) { break }
  $op = Read-Host "1=MP4 720p | 2=MP4 max | 3=MP3 audio [1]"
  if ([string]::IsNullOrWhiteSpace($op)) { $op = "1" }
  if ($op -eq "3") { & .\yt-dlp.exe $url -x --audio-format mp3 -o "%(title)s.%(ext)s" }
  elseif ($op -eq "2") { & .\yt-dlp.exe $url -f "bv*+ba/best" --merge-output-format mp4 -o "%(title)s.%(ext)s" }
  else { & .\yt-dlp.exe $url -f "bv*[height<=720]+ba/best" --merge-output-format mp4 -o "%(title)s.%(ext)s" }
  Write-Host "Listo. Reproduce el archivo con doble clic." -ForegroundColor Cyan
}

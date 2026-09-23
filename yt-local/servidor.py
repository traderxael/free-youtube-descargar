#!/usr/bin/env python3
"""TubeGratis - servidor local (uso personal).
Pega el URL en la app y descarga desde ahi: este servidor usa yt-dlp
con TU internet (IP residencial, no bloqueada por YouTube).

Uso:  python servidor.py   ->  abre http://localhost:8765 en el navegador
Requiere: pip install yt-dlp   (ffmpeg solo si quieres MP3)
Solo libreria estandar + yt-dlp. Sin cuentas, sin claves, gratis.

Seguridad (auditoria 2026-09):
- Allowlist de hosts de YouTube (anti-SSRF: nadie en la LAN puede usar
  este servidor como proxy hacia dominios arbitrarios).
- Streaming por trozos + soporte Range (1GB de video != 1GB de RAM,
  y el video se puede adelantar en el reproductor).
- Content-Disposition blindado (filename*=UTF-8'' para acentos).
"""
import http.server
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse

PORT = 8765
CHUNK = 64 * 1024  # 64 KB por trozo
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(tempfile.gettempdir(), "tubegratis")
os.makedirs(CACHE, exist_ok=True)

FFMPEG = shutil.which("ffmpeg") is not None
MIME = {".html": "text/html; charset=utf-8", ".css": "text/css",
        ".js": "application/javascript", ".json": "application/json",
        ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
        ".webm": "video/webm"}
PAGINAS = {"youtube.html": "youtube.html", "index.html": "index.html",
           "youtube.js": "youtube.js", "app.js": "app.js",
           "youtube.css": "youtube.css", "styles.css": "styles.css"}

# Anti-SSRF: solo YouTube. Cualquier otro host se rechaza con 400.
YT_HOSTS = ("youtube.com", "youtu.be", "youtube-nocookie.com",
            "music.youtube.com", "m.youtube.com")


def _es_youtube(url):
    try:
        host = urllib.parse.urlparse(url).hostname or ""
    except ValueError:
        return False
    host = host.lower().rstrip(".")
    return (host == "youtu.be" or host.endswith(".youtube.com")
            or host.endswith(".youtu.be") or host == "youtube.com"
            or host.endswith(".youtube-nocookie.com"))


def yt_info(url):
    if not _es_youtube(url):
        raise RuntimeError("URL no permitida: solo YouTube")
    p = subprocess.run(
        [sys.executable, "-m", "yt_dlp", "--no-warnings", "--no-playlist",
         "--dump-json", url],
        capture_output=True, text=True, timeout=90)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or "error yt-dlp")[-300:])
    d = json.loads(p.stdout)
    thumbs = d.get("thumbnails") or []
    return {"id": d.get("id"), "title": d.get("title"),
            "channel": d.get("channel") or d.get("uploader"),
            "duration": d.get("duration"),
            "thumbnail": (thumbs[-1].get("url") if thumbs else None)}


def _cache_key(vid, fmt):
    """Clave de cache por id + calidad (antes era solo id y mezclaba)."""
    return vid + "." + fmt


def yt_download(url, fmt):
    """Descarga (cache por id+calidad) y devuelve (ruta, probe)."""
    probe = yt_info(url)
    vid = probe.get("id") or "video"
    calidad = fmt if fmt != "mp3" else "mp3"
    # buscar en cache con clave id.calidad.ext
    for f in os.listdir(CACHE):
        if f.startswith(vid + "."):
            resto = f[len(vid) + 1:]
            if fmt == "mp3" and f.endswith(".mp3"):
                return os.path.join(CACHE, f), probe
            if fmt != "mp3" and not f.endswith(".mp3") and resto.startswith(calidad + "."):
                return os.path.join(CACHE, f), probe
    # formato real pedido (fix: antes 480/360 pedian 720 siempre)
    if fmt == "mp3":
        if not FFMPEG:
            raise RuntimeError("MP3 necesita ffmpeg instalado. Usa MP4 o instala ffmpeg.")
        args = ["-x", "--audio-format", "mp3"]
    elif fmt == "max":
        args = ["-f", "bv*+ba/best", "--merge-output-format", "mp4"]
    elif fmt == "1080":
        args = ["-f", "bv*[height<=1080]+ba/best[ext=mp4]/best",
                "--merge-output-format", "mp4"]
    elif fmt == "720":
        args = ["-f", "bv*[height<=720]+ba/best[ext=mp4]/best",
                "--merge-output-format", "mp4"]
    elif fmt == "480":
        args = ["-f", "bv*[height<=480]+ba/best[ext=mp4]/best",
                "--merge-output-format", "mp4"]
    elif fmt == "360":
        args = ["-f", "bv*[height<=360]+ba/best[ext=mp4]/best",
                "--merge-output-format", "mp4"]
    else:
        raise RuntimeError("calidad no valida: " + str(fmt))
    # nombre de salida incluye la calidad para que la cache no se pise
    out = os.path.join(CACHE, "%(id)s." + calidad + ".%(ext)s")
    p = subprocess.run(
        [sys.executable, "-m", "yt_dlp", "--no-warnings", "--no-playlist",
         *args, "-o", out, url],
        capture_output=True, text=True, timeout=1800)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or "error descarga")[-300:])
    for f in os.listdir(CACHE):
        if f.startswith(vid + "." + calidad + "."):
            return os.path.join(CACHE, f), probe
    raise RuntimeError("descarga ok pero no se encontro el archivo")


def _safe_name(title, ext):
    """Nombre de archivo para Content-Disposition sin inyeccion de headers."""
    name = re.sub(r'[\\/:*?"<>|\r\n]', "_", (title or "video"))[:80]
    ascii_name = re.sub(r"[^A-Za-z0-9._-]", "_", name) or "video"
    # filename*=UTF-8'' para el titulo con acentos; filename= ASCII fallback
    quoted = urllib.parse.quote(name + ext)
    return name, ascii_name, quoted


class H(http.server.BaseHTTPRequestHandler):
    server_version = "TubeGratis/1.1"

    def log_message(self, *a):
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")

    def _json(self, obj, code=200):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Allow-Methods", "GET")
        self.end_headers()

    def _servir_archivo(self, path, probe, download=True):
        """Streaming por trozos + Range. Nunca carga el archivo en RAM."""
        size = os.path.getsize(path)
        ext = os.path.splitext(path)[1]
        name, ascii_name, quoted = _safe_name(probe.get("title"), ext)
        rng = self.headers.get("Range")
        start, end = 0, size - 1
        partial = False
        if rng and rng.startswith("bytes="):
            m = re.match(r"bytes=(\d*)-(\d*)", rng)
            if m:
                if m.group(1):
                    start = int(m.group(1))
                    if start >= size:
                        self.send_response(416)
                        self.send_header("Content-Range",
                                          f"bytes */{size}")
                        self.end_headers()
                        return
                else:
                    # sufijo "bytes=-N": ultimos N bytes
                    start = max(0, size - int(m.group(2)))
                if m.group(2) and m.group(1):
                    end = min(int(m.group(2)), size - 1)
                partial = True
        length = end - start + 1
        self.send_response(206 if partial else 200)
        self._cors()
        self.send_header("Content-Type", MIME.get(ext, "application/octet-stream"))
        self.send_header("Content-Length", str(length))
        self.send_header("Accept-Ranges", "bytes")
        if partial:
            self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        if download:
            self.send_header("Content-Disposition",
                             f"attachment; filename=\"{ascii_name}\"; "
                             f"filename*=UTF-8''{quoted}")
        else:
            self.send_header("Content-Disposition", "inline")
        self.end_headers()
        with open(path, "rb") as f:
            f.seek(start)
            remaining = length
            while remaining > 0:
                trozo = f.read(min(CHUNK, remaining))
                if not trozo:
                    break
                try:
                    self.wfile.write(trozo)
                except (ConnectionAbortedError, BrokenPipeError):
                    return  # cliente cancelo (adelantar video, etc.)
                remaining -= len(trozo)

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        q = urllib.parse.parse_qs(u.query)
        try:
            if u.path == "/api/ping":
                return self._json({"ok": True, "ffmpeg": FFMPEG})
            if u.path == "/api/info":
                url = (q.get("url") or [""])[0]
                if not url:
                    return self._json({"error": "falta ?url="}, 400)
                return self._json(yt_info(url))
            if u.path == "/api/download":
                url = (q.get("url") or [""])[0]
                fmt = (q.get("fmt") or ["720"])[0]
                if not url:
                    return self._json({"error": "falta ?url="}, 400)
                if fmt not in ("mp3", "max", "1080", "720", "480", "360"):
                    return self._json({"error": "calidad no valida"}, 400)
                path, probe = yt_download(url, fmt)
                return self._servir_archivo(path, probe, download=True)
            if u.path == "/api/play":
                # reproducir en la app sin descargar (usa la misma cache)
                url = (q.get("url") or [""])[0]
                fmt = (q.get("fmt") or ["720"])[0]
                if not url:
                    return self._json({"error": "falta ?url="}, 400)
                path, probe = yt_download(url, fmt)
                return self._servir_archivo(path, probe, download=False)
            # archivos de la app (solo los listados: nada de traversal)
            name = u.path.lstrip("/") or "app"
            if name == "app":
                name = ("youtube.html" if os.path.exists(
                    os.path.join(ROOT, "youtube.html")) else "index.html")
            if name not in PAGINAS or ".." in name:
                return self._json({"error": "no encontrado"}, 404)
            real = PAGINAS[name]
            if not os.path.exists(os.path.join(ROOT, real)):
                alt = {"youtube.html": "index.html", "index.html": "youtube.html",
                       "youtube.js": "app.js", "app.js": "youtube.js",
                       "youtube.css": "styles.css", "styles.css": "youtube.css"}[real]
                real = alt
            with open(os.path.join(ROOT, real), "rb") as f:
                data = f.read()
            self.send_response(200)
            self._cors()
            self.send_header("Content-Type", MIME.get(
                os.path.splitext(real)[1], "text/plain"))
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            return self._json({"error": str(e)[:300]}, 500)


if __name__ == "__main__":
    import socket
    try:
        lan = socket.gethostbyname(socket.gethostname())
    except Exception:
        lan = "TU-IP"
    srv = http.server.ThreadingHTTPServer(("0.0.0.0", PORT), H)
    print(f"TubeGratis listo -> http://localhost:{PORT}  (en esta PC)")
    print(f"En el celular (mismo WiFi) -> http://{lan}:{PORT}")
    print("Pega el URL en la app y descarga desde ahi. Ctrl+C para salir.")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass

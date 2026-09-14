#!/usr/bin/env python3
"""TubeGratis - servidor local (uso personal).
Pega el URL en la app y descarga desde ahi: este servidor usa yt-dlp
con TU internet (IP residencial, no bloqueada por YouTube).

Uso:  python servidor.py   ->  abre http://localhost:8765 en el navegador
Requiere: pip install yt-dlp   (ffmpeg solo si quieres MP3)
Solo libreria estandar + yt-dlp. Sin cuentas, sin claves, gratis.
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
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(tempfile.gettempdir(), "tubegratis")
os.makedirs(CACHE, exist_ok=True)

FFMPEG = shutil.which("ffmpeg") is not None
MIME = {".html": "text/html; charset=utf-8", ".css": "text/css",
        ".js": "application/javascript", ".json": "application/json",
        ".mp4": "video/mp4", ".mp3": "audio/mpeg", ".m4a": "audio/mp4",
        ".webm": "video/webm"}
# la app se llama youtube.* aqui y index/app/styles en GitHub: aceptar ambos
PAGINAS = {"youtube.html": "youtube.html", "index.html": "index.html",
           "youtube.js": "youtube.js", "app.js": "app.js",
           "youtube.css": "youtube.css", "styles.css": "styles.css"}


def yt_info(url):
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


def yt_download(url, fmt):
    """Descarga (con cache por id) y devuelve la ruta del archivo."""
    probe = yt_info(url)
    vid = probe.get("id") or "video"
    if fmt == "mp3":
        if not FFMPEG:
            raise RuntimeError("MP3 necesita ffmpeg instalado. Usa MP4 o instala ffmpeg.")
        args = ["-x", "--audio-format", "mp3"]
    elif fmt == "max":
        args = ["-f", "bv*+ba/best", "--merge-output-format", "mp4"]
    else:  #720
        args = ["-f", "bv*[height<=720]+ba/best[ext=mp4]/best",
                "--merge-output-format", "mp4"]
    for f in os.listdir(CACHE):  # cache
        if f.startswith(vid + ".") and f.endswith(
                (".mp4", ".mp3", ".m4a", ".webm")):
            if fmt == "mp3" and not f.endswith(".mp3"):
                continue
            if fmt != "mp3" and f.endswith(".mp3"):
                continue
            return os.path.join(CACHE, f), probe
    out = os.path.join(CACHE, "%(id)s.%(ext)s")
    p = subprocess.run(
        [sys.executable, "-m", "yt_dlp", "--no-warnings", "--no-playlist",
         *args, "-o", out, url],
        capture_output=True, text=True, timeout=1800)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or "error descarga")[-300:])
    for f in os.listdir(CACHE):
        if f.startswith(vid + "."):
            return os.path.join(CACHE, f), probe
    raise RuntimeError("descarga ok pero no se encontro el archivo")


class H(http.server.BaseHTTPRequestHandler):
    server_version = "TubeGratis/1.0"

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
                path, probe = yt_download(url, fmt)
                name = re.sub(r'[\\/:*?"<>|]', "_",
                              (probe.get("title") or "video"))[:80]
                ext = os.path.splitext(path)[1]
                with open(path, "rb") as f:
                    data = f.read()
                self.send_response(200)
                self._cors()
                self.send_header("Content-Type",
                                 MIME.get(ext, "application/octet-stream"))
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Content-Disposition",
                                 f'attachment; filename="{name}{ext}"')
                self.end_headers()
                self.wfile.write(data)
                return
            # archivos de la app
            name = u.path.lstrip("/") or "app"
            if name == "app":
                name = ("youtube.html" if os.path.exists(
                    os.path.join(ROOT, "youtube.html")) else "index.html")
            if name not in PAGINAS or ".." in name:
                return self._json({"error": "no encontrado"}, 404)
            real = PAGINAS[name]
            if not os.path.exists(os.path.join(ROOT, real)):
                # nombre alternativo (youtube.* <-> index/app/styles)
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
    try:  # IP local para abrir la app desde el celular (mismo WiFi)
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

#!/usr/bin/env python3
"""Test directo de _servir_archivo con Range: crea un archivo falso en cache,
levanta el handler en un hilo con el path mapeado y verifica 206/416."""
import http.server
import io
import os
import sys
import tempfile
import threading
import urllib.request

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "yt-local"))
import servidor  # noqa: E402

CACHE = os.path.join(tempfile.gettempdir(), "tubegratis")
os.makedirs(CACHE, exist_ok=True)
TEST = os.path.join(CACHE, "testvideo.720.mp4")
with open(TEST, "wb") as f:
    f.write(b"A" * 1000)  # 1000 bytes falsos

resultados = []


class H(servidor.H):
    def do_GET(self):
        # simular una descarga cacheada sin llamar yt-dlp
        if self.path.startswith("/api/download?test=1"):
            probe = {"title": "video test acentos ñ"}
            return self._servir_archivo(TEST, probe, download=True)
        return servidor.H.do_GET(self)


srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8799), H)
threading.Thread(target=srv.serve_forever, daemon=True).start()

base = "http://127.0.0.1:8799/api/download?test=1"

# 1) descarga completa
r = urllib.request.urlopen(base, timeout=10)
total = len(r.read())
ok1 = total == 1000
resultados.append(("descarga completa 1000 bytes", ok1, total))
ok_cd = "attachment" in r.headers.get("Content-Disposition", "") and "UTF-8''" in r.headers.get("Content-Disposition", "")
resultados.append(("Content-Disposition con UTF-8 para acentos", ok_cd, r.headers.get("Content-Disposition", "")[:80]))

# 2) Range trozo 0-99 -> 206 + 100 bytes
req = urllib.request.Request(base, headers={"Range": "bytes=0-99"})
r = urllib.request.urlopen(req, timeout=10)
n = len(r.read())
ok2 = r.status == 206 and n == 100
resultados.append(("Range 0-99 -> 206 con 100 bytes", ok2, f"{r.status} {n}B"))

# 3) Range sufijo -100 -> 206 + 100 bytes
req = urllib.request.Request(base, headers={"Range": "bytes=-100"})
r = urllib.request.urlopen(req, timeout=10)
n = len(r.read())
ok3 = r.status == 206 and n == 100
resultados.append(("Range sufijo -100 -> 206", ok3, f"{r.status} {n}B"))

# 4) Range invalido (start >= size) -> 416
req = urllib.request.Request(base, headers={"Range": "bytes=5000-"})
try:
    urllib.request.urlopen(req, timeout=10)
    ok4 = False
    code = 200
except urllib.error.HTTPError as e:
    ok4 = e.code == 416
    code = e.code
resultados.append(("Range invalido -> 416", ok4, code))

srv.shutdown()
os.remove(TEST)

fallos = 0
for nombre, ok, detalle in resultados:
    print(("PASS" if ok else "FAIL") + f" | {nombre} ({detalle})")
    if not ok:
        fallos += 1
print(f"{len(resultados) - fallos}/{len(resultados)} correctos")
sys.exit(1 if fallos else 0)

# ▶ TubeGratis — free-youtube-descargar
Descarga videos de YouTube **gratis** y reprodúcelos. Sin registro, sin paywall.

🌐 Demo: abre `index.html` o despliega en Vercel gratis.

## Cómo se usa
1. Abre `index.html` en el navegador.
2. Pega el link de YouTube (watch / youtu.be / shorts).
3. **Reproducir**: player embed oficial (siempre funciona).
4. **Descargar gratis**:
   - Botón ⬇ en la web (vía Cobalt API), MP4 / MP3, o
   - `yt-local/descargar.bat` (doble clic en Windows, método más fiable con `yt-dlp`).

## Por qué dos métodos
- YouTube bloquea las IPs de centros de datos (Vercel, cobalt.tools) desde 2025 → la descarga online pública falla a veces.
- Desde tu PC (IP residencial) con `yt-dlp` sí funciona siempre.

## Repos base (GitHub, gratis y open source)
- https://github.com/yt-dlp/yt-dlp (180k ⭐, descarga local)
- https://github.com/imputnet/cobalt (API de descarga, auto-hospedable)

## Estructura
```
index.html · styles.css · app.js · api/cobalt.js · yt-local/descargar.bat · yt-local/descargar.ps1
```

## Desplegar en Vercel
```bash
npx vercel --prod --yes
# opcional: variable COBALT_API_URL=https://tu-instancia-cobalt para descargas privadas
```

⚖️ Descarga solo videos propios, Creative Commons o con permiso del autor.

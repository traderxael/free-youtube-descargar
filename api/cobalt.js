// Vercel serverless: proxy a tu instancia privada de Cobalt.
// Configura en Vercel: COBALT_API_URL=https://tu-dominio-cobalt  y  COBALT_API_KEY (opcional)
//
// Seguridad (auditoria 2026-09):
// - Allowlist de hosts de YouTube (anti-SSRF: tu Vercel no es un proxy abierto).
// - videoQuality/format validados contra listas cerradas.
// - Sin COBALT_API_URL responde 200 {proxy:false} — el frontend exige proxy:true.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST' });
  const base = (process.env.COBALT_API_URL || '').replace(/\/$/, '');
  if (!base) return res.status(200).json({ proxy: false, msg: 'Sin COBALT_API_URL, el frontend usará instancias públicas' });
  try {
    const { url, videoQuality = '720', format = 'mp4' } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Falta url' });
    if (req.body?.ping) return res.status(200).json({ proxy: true });

    // --- Anti-SSRF: solo YouTube ---
    let host = '';
    try { host = (new URL(url)).hostname.toLowerCase(); } catch { host = ''; }
    const ytOk = host === 'youtu.be' || host.endsWith('.youtube.com') ||
                 host === 'youtube.com' || host.endsWith('.youtube-nocookie.com');
    if (!/^https?:\/\//.test(url) || !ytOk) {
      return res.status(400).json({ error: 'Solo URLs de YouTube' });
    }

    // --- Calidad y formato validados (listas cerradas) ---
    const CALIDADES = new Set(['max', '1080', '720', '480', '360']);
    const FORMATOS = new Set(['mp4', 'mp3']);
    const calidad = String(videoQuality);
    const fmt = String(format);
    if (!CALIDADES.has(calidad) || !FORMATOS.has(fmt)) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }

    const body = fmt === 'mp3'
      ? { url, downloadMode: 'audio', audioFormat: 'mp3' }
      : { url, videoQuality: calidad, filenameStyle: 'basic', youtubeVideoCodec: 'h264' };
    const r = await fetch(base, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(process.env.COBALT_API_KEY ? { Authorization: 'Api-Key ' + process.env.COBALT_API_KEY } : {})
      },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (j.status === 'error') return res.status(502).json({ error: j?.error?.code || 'cobalt error' });
    // solo devolvemos URLs http(s) — nada de javascript: ni data:
    const fileUrl = String(j.url || '');
    if (!/^https?:\/\//.test(fileUrl)) {
      return res.status(502).json({ error: 'Respuesta sin URL válida' });
    }
    return res.status(200).json({ url: fileUrl, filename: j.filename });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

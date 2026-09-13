// Vercel serverless: proxy a tu instancia privada de Cobalt.
// Configura en Vercel: COBALT_API_URL=https://tu-dominio-cobalt  y  COBALT_API_KEY (opcional)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST' });
  const base = (process.env.COBALT_API_URL || '').replace(/\/$/, '');
  if (!base) return res.status(200).json({ proxy: false, msg: 'Sin COBALT_API_URL, el frontend usará instancias públicas' });
  try {
    const { url, videoQuality = '720', format = 'mp4' } = req.body || {};
    if (!url) return res.status(400).json({ error: 'Falta url' });
    if (req.body?.ping) return res.status(200).json({ proxy: true });
    const body = format === 'mp3'
      ? { url, downloadMode: 'audio', audioFormat: 'mp3' }
      : { url, videoQuality, filenameStyle: 'basic', youtubeVideoCodec: 'h264' };
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
    return res.status(200).json({ url: j.url, filename: j.filename });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
}

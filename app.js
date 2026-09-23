// TubeGratis — pegar, reproducir (embed oficial) y descargar vía Cobalt o yt-dlp
const $ = id => document.getElementById(id);
const PUBLIC_COBALT = ['https://cobalt.meowing.de', 'https://api.cobalt.tools'];
const LOCAL = (window.location.port === '8765')
  ? window.location.origin
  : 'http://localhost:8765'; // servidor.py (uso personal)
let currentId = null, currentUrl = '', servidorOK = false, tieneFFmpeg = false;

// --- Toast no bloqueante (reemplaza alert) ---
function toast(msg, tipo = 'info') {
  let t = $('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = 'toast show ' + tipo;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 3500);
}

// Aviso claro si la app corre en HTTPS: el navegador bloquea localhost (mixed content)
if (location.protocol === 'https:') {
  document.addEventListener('DOMContentLoaded', () => {
    toast('⚠️ Desde HTTPS el navegador bloquea el servidor local. Abre la app desde http://localhost:8765 para descarga directa', 'warn');
  });
}

async function chequearServidor() {
  const b = $('srv-badge');
  try {
    const r = await fetch(LOCAL + '/api/ping');
    const j = await r.json();
    servidorOK = !!j.ok; tieneFFmpeg = !!j.ffmpeg;
    b.textContent = servidorOK
      ? '✅ Servidor local conectado: pega el URL y descarga directo desde aquí' + (tieneFFmpeg ? '' : ' (MP3 necesita ffmpeg: usa MP4)')
      : '⚠️ Sin servidor local: inicia yt-local/servidor.py para descarga directa, o usa Cobalt/yt-dlp abajo';
    b.classList.add(servidorOK ? 'ok' : 'warn');
  } catch {
    servidorOK = false;
    b.textContent = '⚠️ Sin servidor local: ejecuta "python yt-local/servidor.py" para descargar directo desde aquí';
    b.classList.add('warn');
  }
}

// --- Parser estricto: solo YouTube, ID de exactamente 11 chars ---
function extraerID(raw) {
  if (!raw) return null;
  raw = raw.trim();
  let u;
  try { u = new URL(raw); } catch { 
    // puede ser un ID pelado
    if (/^[A-Za-z0-9_-]{11}$/.test(raw)) return raw;
    return null;
  }
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const ytHosts = ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com', 'youtu.be'];
  if (!ytHosts.includes(host)) return null;
  let id = null;
  if (host === 'youtu.be') {
    id = u.pathname.split('/').filter(Boolean)[0] || null;
  } else {
    // /watch?v= | /shorts/ID | /embed/ID | /live/ID | music.youtube.com con ?v=
    const v = u.searchParams.get('v');
    if (v) id = v;
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]+)/);
      if (m) id = m[2];
    }
  }
  // estricto: 11 chars, ni 6 ni 15
  if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return id;
  return null;
}

async function pegarPortapapeles() {
  try { $('url').value = await navigator.clipboard.readText(); cargar(); }
  catch { toast('No se pudo leer el portapapeles. Pégalo con Ctrl+V', 'warn'); }
}
function probarDemo() { $('url').value = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; cargar(); }
function copiarLink() { navigator.clipboard.writeText(currentUrl); toast('Link copiado ✅'); }
function abrirEnYT() { window.open(currentUrl, '_blank'); }
function switchTab(t) {
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
  $('tab-yt').classList.toggle('hidden', t !== 'yt');
  $('tab-file').classList.toggle('hidden', t !== 'file');
}
function abrirLocal(input) {
  const f = input.files[0]; if (!f) return;
  $('fileplayer').src = URL.createObjectURL(f);
  switchTab('file');
}

async function cargar() {
  const raw = $('url').value;
  const id = extraerID(raw);
  if (!id) { toast('❌ Ese link no parece de YouTube. Ej: https://www.youtube.com/watch?v=XXXX', 'error'); return; }
  currentId = id;
  currentUrl = 'https://www.youtube.com/watch?v=' + id;
  $('video-id-hint').textContent = 'ID: ' + id;
  $('preview-card').classList.remove('hidden');
  $('vid').textContent = id;
  $('thumb').src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
  $('ytframe').src = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0';
  $('vtitle').textContent = 'Cargando título…';
  $('cmd-preview').textContent = 'yt-dlp.exe "' + currentUrl + '" -o "%(title)s.%(ext)s"';
  try {
    if (servidorOK) {
      const r = await fetch(LOCAL + '/api/info?url=' + encodeURIComponent(currentUrl));
      const j = await r.json();
      if (j.title) { $('vtitle').textContent = j.title + (j.channel ? ' — ' + j.channel : ''); }
      else throw 0;
    } else {
      const r = await fetch('https://noembed.com/embed?url=' + encodeURIComponent(currentUrl));
      const j = await r.json();
      $('vtitle').textContent = j.title || ('Video ' + id);
      $('vtitle').textContent += j.author_name ? ' — ' + j.author_name : '';
    }
  } catch { $('vtitle').textContent = 'Video ' + id; }
  guardarHist(id);
  document.getElementById('preview-card').scrollIntoView({ behavior: 'smooth' });
}

function copiarComando(tipo) {
  if (!currentUrl) { toast('Pega un link primero', 'warn'); return; }
  const cmd = tipo === 'mp3'
    ? 'yt-dlp.exe "' + currentUrl + '" -x --audio-format mp3 -o "%(title)s.%(ext)s"'
    : 'yt-dlp.exe "' + currentUrl + '" -f "bv*[height<=1080]+ba/best" --merge-output-format mp4 -o "%(title)s.%(ext)s"';
  navigator.clipboard.writeText(cmd);
  $('cmd-preview').textContent = cmd;
  toast('✅ Comando copiado. Pégalo en cmd/PowerShell (con yt-dlp.exe en la misma carpeta).');
}

// --- Botón principal protegido contra doble clic ---
let descargando = false;
async function descargar() {
  if (descargando) return;
  if (!currentUrl) { toast('Pega un link primero', 'warn'); return; }
  const st = $('dl-status'), box = $('dl-link');
  const quality = $('quality').value, format = $('format').value;
  box.innerHTML = '';
  if (servidorOK) {
    if (format === 'mp3' && !tieneFFmpeg) {
      // fix: degradacion REAL a MP4 (antes decia MP4 pero pedia MP3)
      st.textContent = '⚠️ MP3 necesita ffmpeg. Descargando MP4 en su lugar — elige calidad abajo.';
      const fmtVideo = (quality === 'max') ? 'max' : quality; // 1080/720/480/360 reales
      const link = document.createElement('a');
      link.href = LOCAL + '/api/download?url=' + encodeURIComponent(currentUrl) + '&fmt=' + encodeURIComponent(fmtVideo);
      link.textContent = '⬇ Descargar MP4 (' + fmtVideo + ') ahora';
      link.download = '';
      box.appendChild(link);
      link.click();
      st.textContent = '✅ Descarga MP4 iniciada desde tu servidor local. Instala ffmpeg para MP3.';
      return;
    }
    descargando = true;
    try {
      st.textContent = '⏳ Descargando con tu servidor local… (segunda vez es instantáneo: queda en caché)';
      // fix: calidad REAL del select (antes todo caía a 720 salvo max)
      const fmt = format === 'mp3' ? 'mp3' : quality;
      const link = document.createElement('a');
      link.href = LOCAL + '/api/download?url=' + encodeURIComponent(currentUrl) + '&fmt=' + encodeURIComponent(fmt);
      link.textContent = '⬇ Descargar ' + (format === 'mp3' ? 'MP3' : 'MP4 (' + fmt + ')') + ' ahora';
      link.download = '';
      box.appendChild(link);
      link.click(); // descarga directa desde la app
      st.textContent = '✅ Descarga iniciada desde tu servidor local. Revisa tu carpeta de descargas.';
    } finally { descargando = false; }
    return;
  }
  return descargarCobalt();
}

async function descargarCobalt() {
  if (!currentUrl) { toast('Pega un link primero', 'warn'); return; }
  const st = $('dl-status'), box = $('dl-link');
  const quality = $('quality').value, format = $('format').value;
  const custom = $('apiurl').value.trim().replace(/\/$/, '');
  const apis = custom ? [custom] : PUBLIC_COBALT;
  // fix: el probe ahora exige proxy:true (antes con .ok armaba un link vacío)
  try {
    const probe = await fetch('/api/cobalt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: currentUrl, ping: true }) });
    if (probe.ok) {
      const pj = await probe.json().catch(() => ({}));
      if (pj.proxy === true) { return descargarViaProxy(currentUrl, quality, format, st, box); }
    }
  } catch {}
  st.textContent = '⏳ Contactando Cobalt… (si la pública falla, usa yt-dlp o tu instancia propia)';
  box.innerHTML = '';
  const body = format === 'mp3'
    ? { url: currentUrl, downloadMode: 'audio', audioFormat: 'mp3' }
    : { url: currentUrl, videoQuality: quality, filenameStyle: 'basic', youtubeVideoCodec: 'h264' };
  let lastErr = '';
  for (const api of apis) {
    try {
      const r = await fetch(api, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.status === 'error') throw new Error(j.error?.code || 'error api');
      const fileUrl = String(j.url || j.stream || '');
      // fix XSS: solo http(s), nada de javascript:/data:
      if (!/^https?:\/\//.test(fileUrl)) throw new Error('URL de descarga inválida');
      const name = (j.filename || ('youtube-' + currentId + (format === 'mp3' ? '.mp3' : '.mp4')));
      st.textContent = '✅ Listo vía ' + api;
      box.innerHTML = '';
      const a = document.createElement('a');
      // fix XSS: textContent + atributos via propiedades (nunca innerHTML con datos externos)
      a.href = fileUrl;
      a.textContent = '⬇ Descargar ' + name;
      a.target = '_blank'; a.rel = 'noopener';
      a.download = name;
      box.appendChild(a);
      if (format !== 'mp3') { $('fileplayer').src = fileUrl; }
      return;
    } catch (e) { lastErr = String(e.message || e); }
  }
  st.textContent = '❌ Las instancias públicas están bloqueadas para YouTube (bloqueo de YouTube desde 2025). ✅ Solución gratis: usa yt-local/descargar.bat o monta tu Cobalt propio. (' + lastErr + ')';
}

async function descargarViaProxy(url, quality, format, st, box) {
  st.textContent = '⏳ Descargando vía tu servidor /api/cobalt…';
  const r = await fetch('/api/cobalt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, videoQuality: quality, format }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'proxy error');
  const fileUrl = String(j.url || '');
  if (!/^https?:\/\//.test(fileUrl)) throw new Error('URL de descarga inválida');
  st.textContent = '✅ Listo vía tu servidor';
  box.innerHTML = '';
  const a = document.createElement('a');
  // fix XSS: nodos con textContent, atributos por propiedad
  a.href = fileUrl;
  a.textContent = '⬇ Descargar ' + (j.filename || 'video');
  a.target = '_blank'; a.rel = 'noopener';
  a.download = (j.filename || 'video.mp4');
  box.appendChild(a);
  if (format !== 'mp3') $('fileplayer').src = fileUrl;
}

// Historial local
function guardarHist(id) {
  let h = JSON.parse(localStorage.getItem('tg_hist') || '[]');
  h = [{ id, url: 'https://www.youtube.com/watch?v=' + id, t: Date.now() }, ...h.filter(x => x.id !== id)].slice(0, 12);
  localStorage.setItem('tg_hist', JSON.stringify(h));
  pintarHist();
}
function pintarHist() {
  const h = JSON.parse(localStorage.getItem('tg_hist') || '[]');
  const cont = $('historial');
  cont.innerHTML = h.length ? '' : '';
  if (!h.length) {
    const s = document.createElement('span');
    s.className = 'hint';
    s.textContent = 'Vacío. Tus últimos 12 videos saldrán aquí.';
    cont.appendChild(s);
    return;
  }
  h.forEach(v => {
    // fix XSS: historial pintado con nodos (el ID ya es validado 11 chars, pero igual)
    const d = document.createElement('div'); d.className = 'hist-item';
    const img = document.createElement('img');
    img.src = 'https://i.ytimg.com/vi/' + encodeURIComponent(v.id) + '/default.jpg';
    const span = document.createElement('span');
    const code = document.createElement('code');
    code.textContent = v.id;
    const small = document.createElement('small');
    small.textContent = new Date(v.t).toLocaleString();
    span.appendChild(code);
    span.appendChild(document.createElement('br'));
    span.appendChild(small);
    d.appendChild(img); d.appendChild(span);
    const b = document.createElement('button'); b.className = 'btn ghost sm'; b.textContent = 'Cargar';
    b.onclick = () => { $('url').value = v.url; cargar(); };
    d.appendChild(b);
    $('historial').appendChild(d);
  });
}
function limpiarHist() { localStorage.removeItem('tg_hist'); pintarHist(); }

$('btn-cargar').onclick = cargar;
$('url').addEventListener('keydown', e => { if (e.key === 'Enter') cargar(); });
pintarHist();
chequearServidor();

// TubeGratis — pegar, reproducir (embed oficial) y descargar vía Cobalt o yt-dlp
const $ = id => document.getElementById(id);
const PUBLIC_COBALT = ['https://cobalt.meowing.de', 'https://api.cobalt.tools'];
let currentId = null, currentUrl = '';

function extraerID(url) {
  if (!url) return null;
  url = url.trim();
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/|music\?.*v=)|youtu\.be\/)([A-Za-z0-9_-]{6,15})/);
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(url)) return url;
  return null;
}

async function pegarPortapapeles() {
  try { $('url').value = await navigator.clipboard.readText(); cargar(); }
  catch { alert('No se pudo leer el portapapeles. Pégalo con Ctrl+V'); }
}
function probarDemo() { $('url').value = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; cargar(); }
function copiarLink() { navigator.clipboard.writeText(currentUrl); alert('Link copiado'); }
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
  if (!id) { alert('❌ Ese link no parece de YouTube. Ej: https://www.youtube.com/watch?v=XXXX'); return; }
  currentId = id;
  currentUrl = 'https://www.youtube.com/watch?v=' + id;
  $('video-id-hint').textContent = 'ID: ' + id;
  $('preview-card').classList.remove('hidden');
  $('vid').textContent = id;
  $('thumb').src = 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg';
  $('ytframe').src = 'https://www.youtube-nocookie.com/embed/' + id + '?rel=0';
  $('vtitle').textContent = 'Cargando título…';
  $('cmd-preview').textContent = 'yt-dlp.exe "' + currentUrl + '" -o "%(title)s.%(ext)s"';
  // Título gratis sin API key (noembed + oembed de youtube)
  try {
    const r = await fetch('https://noembed.com/embed?url=' + encodeURIComponent(currentUrl));
    const j = await r.json();
    $('vtitle').textContent = j.title || ('Video ' + id);
    $('vtitle').textContent += j.author_name ? ' — ' + j.author_name : '';
  } catch { $('vtitle').textContent = 'Video ' + id; }
  guardarHist(id);
  document.getElementById('preview-card').scrollIntoView({ behavior: 'smooth' });
}

function copiarComando(tipo) {
  if (!currentUrl) { alert('Pega un link primero'); return; }
  const cmd = tipo === 'mp3'
    ? 'yt-dlp.exe "' + currentUrl + '" -x --audio-format mp3 -o "%(title)s.%(ext)s"'
    : 'yt-dlp.exe "' + currentUrl + '" -f "bv*[height<=1080]+ba/best" --merge-output-format mp4 -o "%(title)s.%(ext)s"';
  navigator.clipboard.writeText(cmd);
  $('cmd-preview').textContent = cmd;
  alert('✅ Comando copiado. Pégalo en cmd/PowerShell (con yt-dlp.exe en la misma carpeta).');
}

async function descargarCobalt() {
  if (!currentUrl) { alert('Pega un link primero'); return; }
  const st = $('dl-status'), box = $('dl-link');
  const quality = $('quality').value, format = $('format').value;
  const custom = $('apiurl').value.trim().replace(/\/$/, '');
  const apis = custom ? [custom] : PUBLIC_COBALT;
  // Si hay backend Vercel /api/cobalt, úsalo primero (evita CORS)
  try {
    const probe = await fetch('/api/cobalt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: currentUrl, ping: true }) });
    if (probe.ok) { return descargarViaProxy(currentUrl, quality, format, st, box); }
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
      const fileUrl = j.url || j.stream;
      if (!fileUrl) throw new Error('sin url');
      const name = (j.filename || ('youtube-' + currentId + (format === 'mp3' ? '.mp3' : '.mp4')));
      st.textContent = '✅ Listo vía ' + api;
      box.innerHTML = '';
      const a = document.createElement('a');
      a.href = fileUrl; a.textContent = '⬇ Descargar ' + name; a.target = '_blank'; a.rel = 'noopener'; a.download = name;
      box.appendChild(a);
      if (format !== 'mp3') { $('fileplayer').src = fileUrl; }
      return;
    } catch (e) { lastErr = String(e.message || e); }
  }
  st.innerHTML = '❌ Las instancias públicas están bloqueadas para YouTube (bloqueo de YouTube desde 2025).<br>✅ Solución gratis: usa <b>yt-local/descargar.bat</b> o monta tu Cobalt propio. <small>' + lastErr + '</small>';
}

async function descargarViaProxy(url, quality, format, st, box) {
  st.textContent = '⏳ Descargando vía tu servidor /api/cobalt…';
  const r = await fetch('/api/cobalt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url, videoQuality: quality, format }) });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || 'proxy error');
  st.textContent = '✅ Listo vía tu servidor';
  box.innerHTML = '<a href="' + j.url + '" target="_blank" rel="noopener" download="' + (j.filename || 'video.mp4') + '">⬇ Descargar ' + (j.filename || 'video') + '</a>';
  if (format !== 'mp3') $('fileplayer').src = j.url;
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
  $('historial').innerHTML = h.length ? '' : '<span class="hint">Vacío. Tus últimos 12 videos saldrán aquí.</span>';
  h.forEach(v => {
    const d = document.createElement('div'); d.className = 'hist-item';
    d.innerHTML = '<img src="https://i.ytimg.com/vi/' + v.id + '/default.jpg"/><span><code>' + v.id + '</code><br><small>' + new Date(v.t).toLocaleString() + '</small></span>';
    const b = document.createElement('button'); b.className = 'btn ghost sm'; b.textContent = 'Cargar';
    b.onclick = () => { $('url').value = v.url; cargar(); };
    d.appendChild(b); $('historial').appendChild(d);
  });
}
function limpiarHist() { localStorage.removeItem('tg_hist'); pintarHist(); }

$('btn-cargar').onclick = cargar;
$('url').addEventListener('keydown', e => { if (e.key === 'Enter') cargar(); });
pintarHist();

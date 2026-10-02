// TubeGratis — parser de URLs de YouTube.
// Modulo UMD: se carga como <script> en el navegador y como require() en Node,
// de modo que el test usa EXACTAMENTE la misma funcion que la app web.
// No usar 'use strict' a nivel de archivo: envuelve en IIFE para no affecting window.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();          // Node (test_parser.js)
  } else {
    root.extraerID = factory().extraerID; // navegador (window.extraerID)
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Parser estricto: solo YouTube, ID de exactamente 11 chars.
  // Anti-abuso: rejecta cualquier host fuera de la allowlist para que el sitio
  // no se convierta en un proxy de descargas hacia terceros.
  var YOUTUBE_HOSTS = [
    'youtube.com', 'm.youtube.com', 'music.youtube.com',
    'youtube-nocookie.com', 'youtu.be'
  ];
  var ID_RE = /^[A-Za-z0-9_-]{11}$/;

  function extraerID(raw) {
    if (!raw) return null;
    raw = String(raw).trim();
    if (!raw) return null;

    var u;
    try {
      u = new URL(raw);
    } catch {
      // puede ser un ID pelado
      if (ID_RE.test(raw)) return raw;
      return null;
    }

    var host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (YOUTUBE_HOSTS.indexOf(host) === -1) return null;

    var id = null;
    if (host === 'youtu.be') {
      id = u.pathname.split('/').filter(Boolean)[0] || null;
    } else {
      // /watch?v= | /shorts/ID | /embed/ID | /live/ID | music.youtube.com con ?v=
      var v = u.searchParams.get('v');
      if (v) {
        id = v;
      } else {
        var m = u.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]+)/);
        if (m) id = m[2];
      }
    }

    // estricto: 11 chars, ni 6 ni 15
    if (id && ID_RE.test(id)) return id;
    return null;
  }

  return { extraerID: extraerID, YOUTUBE_HOSTS: YOUTUBE_HOSTS };
});
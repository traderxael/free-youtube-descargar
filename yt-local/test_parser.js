// Tests del parser de URLs (casos de la auditoria)
// Consume el MISMO modulo que usa la web (yt-local/app_parser.js, UMD):
// si esta logica cambia, el test falla — no hay copia que se quede vieja.
const { extraerID } = require('./app_parser.js');

const casos = [
  // formatos validos de YouTube
  ['https://www.youtube.com/watch?v=jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://youtu.be/jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://www.youtube.com/watch?v=jNQXAC9IVRw&t=42s', 'jNQXAC9IVRw'],
  ['https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PLxyz123', 'jNQXAC9IVRw'],
  ['https://music.youtube.com/watch?v=jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://www.youtube.com/shorts/jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://www.youtube.com/embed/jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://www.youtube.com/live/jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://m.youtube.com/watch?v=jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://youtube.com/watch?v=jNQXAC9IVRw', 'jNQXAC9IVRw'],

  // ID pelado (11 chars exactos)
  ['jNQXAC9IVRw', 'jNQXAC9IVRw'],

  // seguridad: host fuera de la allowlist (anti-proxy)
  ['https://evil.com/watch?v=jNQXAC9IVRw', null],
  ['https://youtube.com.evil.net/watch?v=jNQXAC9IVRw', null],  // sufijo deceptive
  ['https://notyoutube.com/watch?v=jNQXAC9IVRw', null],

  // esquemas peligrosos
  ['javascript:alert(1)', null],
  ['data:text/html,<script>alert(1)</script>', null],
  ['file:///etc/passwd', null],

  // longitud de ID estricta: ni 6 ni 15
  ['https://www.youtube.com/watch?v=short', null],
  ['https://www.youtube.com/watch?v=waytooloolongvideoid', null],

  // entradas vacias / basura
  ['', null],
  ['   ', null],
  [null, null],
  [undefined, null],

  // texto que parece una URL pero no lo es
  ['no soy una url', null],
  ['youtube.com/watch?v=jNQXAC9IVRw', null], // sin esquema: solo el ID pelado se acepta
];

let ok = 0;
const fallos = [];
for (const [input, esperado] of casos) {
  const got = extraerID(input);
  const pass = got === esperado;
  if (pass) ok++;
  else fallos.push({ input, esperado, got });
  const etiqueta = String(input);
  console.log(
    (pass ? 'PASS' : 'FAIL') + ' | ' +
    etiqueta.slice(0, 50).padEnd(50) + ' -> ' + JSON.stringify(got)
  );
}

console.log(ok + '/' + casos.length + ' correctos');
if (fallos.length) {
  console.error('\nCasos que fallaron:');
  for (const f of fallos) {
    console.error('  input=' + JSON.stringify(f.input) +
                  '  esperado=' + JSON.stringify(f.esperado) +
                  '  obtenido=' + JSON.stringify(f.got));
  }
  process.exit(1);
}
process.exit(0);
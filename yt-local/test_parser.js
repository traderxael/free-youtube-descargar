// Tests del parser de URLs (casos de la auditoria)
const extraerID = require('./app_parser_test_helper.js');

const casos = [
  ['https://www.youtube.com/watch?v=jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://youtu.be/jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://www.youtube.com/watch?v=jNQXAC9IVRw&t=42s', 'jNQXAC9IVRw'],
  ['https://www.youtube.com/watch?v=jNQXAC9IVRw&list=PLxyz123', 'jNQXAC9IVRw'],
  ['https://music.youtube.com/watch?v=jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['https://evil.com/watch?v=jNQXAC9IVRw', null],           // dominio falso
  ['https://www.youtube.com/watch?v=short', null],           // ID de 5 chars
  ['jNQXAC9IVRw', 'jNQXAC9IVRw'],                            // ID pelado
  ['https://www.youtube.com/shorts/jNQXAC9IVRw', 'jNQXAC9IVRw'],
  ['javascript:alert(1)', null],                              // XSS via URL
];
let ok = 0;
for (const [input, esperado] of casos) {
  const got = extraerID(input);
  const pass = got === esperado;
  if (pass) ok++;
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + input.slice(0, 50) + ' -> ' + got);
}
console.log(ok + '/' + casos.length + ' correctos');
process.exit(ok === casos.length ? 0 : 1);

/* Simula el navegador con un DOM real (jsdom si esta; si no, stub minimo).
   Objetivo: comprobar que app_parser.js + app.js cargan en ese ORDEN
   sin ReferenceError y que app.js encuentra window.extraerID. */
const fs = require('fs');
const path = require('path');

const REPO = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

function makeEl() {
  const el = {
    style: {}, dataset: {}, files: [], value: '', textContent: '', innerHTML: '', src: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, removeChild() {},
    setAttribute() {}, getAttribute: () => null, querySelector: () => null,
    querySelectorAll: () => [], focus() {}, click() {}, closest: () => null,
  };
  return el;
}

// stub de DOM: todo elemento existe y devuelve un objeto con textContent
const doc = {
  getElementById: () => makeEl(),
  querySelector: () => makeEl(),
  querySelectorAll: () => [],
  createElement: () => makeEl(),
  body: makeEl(),
  addEventListener() {},
  readyState: 'complete',
};

// ---- intento 1: jsdom si esta disponible ----
let harness = null;
try {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM(read('index.html'), { runScripts: 'outside-only', url: 'http://localhost/' });
  const w = dom.window;
  harness = { win: w, run: (src, name) => w.eval(src + '\n//# sourceURL=' + name) };
  console.log('motor: jsdom real');
} catch {
  // ---- intento 2: vm con stubs (suficiente para validar carga y refs) ----
  const vm = require('vm');
  const win = {
    document: doc, navigator: {}, console, URL, setTimeout, clearTimeout,
    location: { port: '', href: 'http://localhost/', origin: 'http://localhost' },
    fetch: () => Promise.reject(new Error('sin red en el harness')),
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    alert: () => {}, confirm: () => false,
    indexedDB: undefined,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    addEventListener() {},
  };
  win.window = win; win.self = win; win.globalThis = win;
  vm.createContext(win);
  harness = { win, run: (src, name) => vm.runInContext(src, win, { filename: name }) };
  console.log('motor: vm + stubs de DOM');
}

const win = harness.win;

console.log('\n=== ORDEN REAL DE CARGA (como en index.html) ===');
try {
  harness.run(read('yt-local/app_parser.js'), 'app_parser.js');
  console.log('  1) app_parser.js  -> typeof window.extraerID =', typeof win.extraerID);
  if (typeof win.extraerID !== 'function') throw new Error('extraerID no quedo definido');
  console.log('     extraerID("https://youtu.be/jNQXAC9IVRw") =', win.extraerID('https://youtu.be/jNQXAC9IVRw'));
  console.log('     extraerID("https://evil.com/watch?v=jNQXAC9IVRw") =', win.extraerID('https://evil.com/watch?v=jNQXAC9IVRw'));
  console.log('     extraerID("jNQXAC9IVRw") =', win.extraerID('jNQXAC9IVRw'));

  harness.run(read('app.js'), 'app.js');
  console.log('  2) app.js         -> cargo SIN ReferenceError');
  console.log('\nRESULTADO: la web carga correctamente con el parser inyectado');
} catch (e) {
  console.log('\nRESULTADO: FALLO ->', e.message);
  process.exit(1);
}
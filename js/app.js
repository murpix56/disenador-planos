/* Diseñador de planos · Policía Local de Don Benito (uso personal)
 * Plano gris y blanco (o calles / satélite), recorrido que sigue las calles, color, flechas y nombres a medida, y descarga en PNG. */
import { $, esc, uid, lsGet, lsSet, lengthM } from './util.js?v=20261108j';
import { net, CFG, loadNet, loadVerdes, snap, route, merc, searchStreets, streetBounds } from './net.js?v=20261108j';
import { filasLeyenda, dibujar, crearVista, trazoEn, etiquetaEn, elementoEn, imagen, dibujarSenal, SENALES, TRAFICO, REFERENCIAS, TIERRA, ESTILO_CARTEL } from './render.js?v=20261108j';

/* ───────── Proyecto ───────── */
const PROY_KEY = 'plano.proyecto.v1';
const PALETA = ['#16a34a', '#d92d20', '#f79009', '#1d5fb5', '#7a5af8', '#101828'];
const FORMATOS = [['1080x1080', 'Cuadrado 1080×1080'], ['1080x1350', 'Vertical 1080×1350'], ['1200x630', 'Horizontal 1200×630'], ['2160x2160', 'Cuadrado HD 2160×2160']];
const LEY_DEF = { on: false, esq: 'bi', ocultos: ['s:salida', 's:meta'], tam: 15, borde: '#d92d20', fondo: '#ffffff', color: '#101828' };
const nuevoProyecto = () => ({ nombre: 'Plano sin título', base: 'gris', gris: { fondo: '#e6e6e6', calle: '#ffffff', ancho: 1 }, trazos: [], marcas: [], notas: [], leyenda: { ...LEY_DEF } });
const nuevaMarca = (tipo, lat, lon) => ({ id: uid(), tipo, lat, lon, tam: 40, rot: 0, texto: '', ttam: 13, color: '#1d5fb5', halo: '#ffffff', mayus: true });
const nuevaNota = (lat, lon) => ({ id: uid(), texto: 'TEXTO', lat, lon, ancla: null, tam: 16, color: '#1d5fb5', fondo: '#ffffff', borde: '#1d5fb5', bw: 3, mayus: true });
const nuevoTrazo = n => ({ id: uid(), nombre: 'Trazo ' + n, color: '#16a34a', ancho: 7, borde: true, discontinuo: false, visible: true, flechas: { on: true, color: '#1d5fb5', tam: 20, sep: 220 }, segs: [], etiquetas: [] });
const nuevaEtiqueta = (texto, lat, lon) => ({ id: uid(), texto, lat, lon, giro: 0, visible: true, ...ESTILO_CARTEL });
function normalizar(j) {
  const d = nuevoProyecto(), base = nuevoTrazo(1);
  return { ...d, ...j, gris: { ...d.gris, ...(j.gris || {}) }, leyenda: { ...LEY_DEF, ...(j.leyenda || {}) }, marcas: (j.marcas || []).map(m => ({ ...nuevaMarca('prohibido', 0, 0), ...m })), notas: (j.notas || []).map(n => ({ ...nuevaNota(0, 0), ...n })), trazos: (j.trazos || []).map(t => ({ ...base, ...t, flechas: { ...base.flechas, ...(t.flechas || {}) }, etiquetas: (t.etiquetas || []).map(l => ({ ...nuevaEtiqueta('', 0, 0), ...l })) })) };
}
function cargar() { try { const j = JSON.parse(lsGet(PROY_KEY, 'null')); if (j && Array.isArray(j.trazos)) return normalizar(j); } catch { /* proyecto dañado */ } return nuevoProyecto(); }
const hist = { pila: [], pos: -1, ult: '' };
function tomarFoto() { const j = JSON.stringify(S.p); if (j === hist.ult) return; hist.pila = hist.pila.slice(0, hist.pos + 1); hist.pila.push(j); if (hist.pila.length > 60) hist.pila.shift(); hist.pos = hist.pila.length - 1; hist.ult = j; }
function actualizarHist() { const u = document.getElementById('btnUndo'), r = document.getElementById('btnRedo'); if (u) u.disabled = hist.pos <= 0; if (r) r.disabled = hist.pos >= hist.pila.length - 1; }
let tg = 0; const guardar = () => { clearTimeout(tg); tg = setTimeout(() => { lsSet(PROY_KEY, JSON.stringify(S.p)); tomarFoto(); actualizarHist(); if (S.p.libId && leerBib().some(x => x.id === S.p.libId)) guardarEnBib(true); }, 350); };

/* ───────── Mis planos (lista guardada en este navegador) ───────── */
const BIB_KEY = 'plano.biblioteca.v1';
function leerBib() { try { const j = JSON.parse(lsGet(BIB_KEY, '[]')); return Array.isArray(j) ? j : []; } catch { return []; } }
function escribirBib(l) { if (!lsSet(BIB_KEY, JSON.stringify(l))) aviso('No hay espacio en el navegador para guardar. Usa «Guardar archivo».'); }
const vistaMapa = () => { const c = map.getCenter(); return { lat: c.lat, lng: c.lng, zoom: map.getZoom() }; };
function guardarEnBib(silencio) {
  const l = leerBib(); if (!S.p.libId) S.p.libId = uid();
  const e = { id: S.p.libId, nombre: S.p.nombre || 'Plano sin título', fecha: Date.now(), p: JSON.parse(JSON.stringify(S.p)), vista: vistaMapa() };
  const i = l.findIndex(x => x.id === e.id); if (i >= 0) l[i] = e; else l.unshift(e);
  escribirBib(l); if (!silencio) { lsSet(PROY_KEY, JSON.stringify(S.p)); aviso('Plano guardado en «Mis planos»'); render(); }
}
function abrirDeBib(id) {
  const e = leerBib().find(x => x.id === id); if (!e) return;
  if (!S.p.libId && S.p.trazos.length && !confirm('El plano actual no está guardado en «Mis planos». ¿Abrir otro y descartarlo?')) return;
  S.p = normalizar({ ...e.p, libId: e.id }); S.sel = selVacio(); S.dib = null; hist.pila = []; hist.pos = -1; hist.ult = '';
  lsSet(PROY_KEY, JSON.stringify(S.p)); tomarFoto(); actualizarHist(); aplicarBase();
  if (e.vista) map.setView([e.vista.lat, e.vista.lng], e.vista.zoom, { animate: false });
  render(); redibujar(); aviso('Plano abierto: ' + e.nombre);
}
function duplicarBib(id) {
  const l = leerBib(), e = l.find(x => x.id === id); if (!e) return;
  const c = JSON.parse(JSON.stringify(e)); c.id = uid(); c.nombre = e.nombre + ' (copia)'; c.p.nombre = c.nombre; c.p.libId = c.id; c.fecha = Date.now();
  l.unshift(c); escribirBib(l); render(); aviso('Copia creada');
}
function borrarDeBib(id) { escribirBib(leerBib().filter(x => x.id !== id)); if (S.p.libId === id) { delete S.p.libId; lsSet(PROY_KEY, JSON.stringify(S.p)); } render(); }
const fechaCorta = t => new Date(t).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
let tv = 0; /* recuerda la vista del mapa (y la del plano guardado) */
const guardarVista = () => { clearTimeout(tv); tv = setTimeout(() => { const v = vistaMapa(); lsSet('plano.vista.v1', JSON.stringify(v)); if (S.p.libId) { const l = leerBib(), e = l.find(x => x.id === S.p.libId); if (e) { e.vista = v; escribirBib(l); } } }, 500); };
function irHist(dir) {
  clearTimeout(tg); lsSet(PROY_KEY, JSON.stringify(S.p)); tomarFoto();
  const n = hist.pos + dir; if (n < 0 || n >= hist.pila.length) return;
  hist.pos = n; hist.ult = hist.pila[n]; S.p = normalizar(JSON.parse(hist.ult)); S.sel = selVacio(); lsSet(PROY_KEY, hist.ult);
  aplicarBase(); render(); redibujar(); actualizarHist();
}
const deshacerProy = () => irHist(-1), rehacerProy = () => irHist(1);

const selVacio = () => ({ trazo: null, label: null, marca: null, nota: null });
const S = { p: cargar(), tab: 'trazos', sel: selVacio(), preset: 'itinerario', autoMarcas: true, dib: null, hover: null, colocar: null, drag: null, suprimir: false, abreviar: true, radioZona: 25, netTxt: 'Cargando callejero…', marco: { on: true, fmt: '1080x1080', w: 1080, h: 1080, px: { w: 0, h: 0 } } };
const selTrazoObj = () => S.p.trazos.find(t => t.id === S.sel.trazo);
const buscarEt = id => { for (const t of S.p.trazos) { const l = t.etiquetas.find(x => x.id === id); if (l) return l; } return null; };

/* ───────── Mapa ───────── */
const map = L.map('map', { zoomControl: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false, zoomSnap: 0.25, zoomDelta: 0.5, wheelPxPerZoomLevel: 90, attributionControl: false }).setView(CFG.center, 15.5);
L.control.attribution({ prefix: false }).addTo(map).addAttribution('© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>');
const bases = {
  osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: true }),
  sat: L.tileLayer('https://www.ign.es/wmts/pnoa-ma?service=WMTS&request=GetTile&version=1.0.0&layer=OI.OrthoimageCoverage&style=default&tilematrixset=GoogleMapsCompatible&format=image/jpeg&tilematrix={z}&tilerow={y}&tilecol={x}', { maxZoom: 19, crossOrigin: true }),
};
try { const v = JSON.parse(lsGet('plano.vista.v1', 'null')); if (v && isFinite(v.lat) && isFinite(v.lng) && isFinite(v.zoom)) map.setView([v.lat, v.lng], v.zoom, { animate: false }); } catch { /* sin vista guardada */ }
const cont = map.getContainer(), lienzo = document.createElement('canvas'); lienzo.className = 'capa'; cont.appendChild(lienzo);
let raf = 0, hits = { labels: [], trazos: [] };
const redibujar = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; pintar(); }); };
function pintar() {
  const sz = map.getSize(), dpr = window.devicePixelRatio || 1;
  if (lienzo.width !== Math.round(sz.x * dpr) || lienzo.height !== Math.round(sz.y * dpr)) { lienzo.width = Math.round(sz.x * dpr); lienzo.height = Math.round(sz.y * dpr); lienzo.style.width = sz.x + 'px'; lienzo.style.height = sz.y + 'px'; }
  const ctx = lienzo.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const c = map.getCenter(), m = merc(c.lat, c.lng);
  const fr = S.tab === 'exportar' && S.marco.on && !S.dib && S.marco.px.w ? S.marco.px : null, area = fr ? { x: (sz.x - fr.w) / 2, y: (sz.y - fr.h) / 2, w: fr.w, h: fr.h } : null;
  hits = dibujar(ctx, crearVista(m[0], m[1], 256 * Math.pow(2, map.getZoom()), sz.x, sz.y, 1), S.p, { ui: true, sel: S.sel, borrador: S.dib ? borradorUI() : null, area });
  actualizarMarco();
}
map.on('move zoom resize viewreset', redibujar); map.on('moveend', guardarVista);
new ResizeObserver(() => { map.invalidateSize(); redibujar(); }).observe(cont);
function aplicarBase() {
  Object.values(bases).forEach(b => { if (map.hasLayer(b)) map.removeLayer(b); });
  if (bases[S.p.base]) bases[S.p.base].addTo(map);
  if (S.p.base === 'tierra' && !net.verdes) loadVerdes().then(ok => { if (!ok && !net.verdes) aviso('No se pudieron descargar las zonas verdes. Se reintentará al elegir de nuevo el fondo Beige.'); else redibujar(); });
  cont.style.background = S.p.base === 'gris' ? S.p.gris.fondo : S.p.base === 'tierra' ? TIERRA.fondo : '#dfe5ea'; redibujar();
}

/* ───────── Dibujo del recorrido ───────── */
const aviso = t => { const e = $('#aviso'); e.textContent = t; e.classList.add('on'); clearTimeout(aviso.t); aviso.t = setTimeout(() => e.classList.remove('on'), 3200); };
const nuevoBorrador = () => ({ modo: net.ready ? 'calles' : 'libre', segs: [], wps: [], legs: [] });
/* Quita los rebotes: ir hasta un punto pasado el cruce y volver por el mismo sitio */
function sinRebotes(p) { const o = []; for (const q of p) { const n = o.length; if (n >= 2 && o[n - 2][0] === q[0] && o[n - 2][1] === q[1]) o.pop(); else o.push(q); } return o; }
const curPath = d => sinRebotes(d.legs.flatMap((l, i) => (i === 0 ? l.path : l.path.slice(1))));
const borradorUI = () => { const d = S.dib; return { segs: d.segs.map(s => s.path), cur: d.wps.length > 1 ? curPath(d) : [], wps: d.wps, hover: S.hover }; };
const unir = tr => { const out = []; for (const t of tr) { const l = out[out.length - 1]; if (l && l.name === t.name) l.pts.push(...t.pts.slice(1)); else out.push({ name: t.name, pts: [...t.pts] }); } return out; };
const mppEn = lat => 40075016.686 * Math.cos(lat * Math.PI / 180) / (256 * Math.pow(2, map.getZoom()));
function addPunto(ll) {
  const d = S.dib; let pt;
  if (d.modo === 'calles' && net.ready) { pt = snap(ll.lat, ll.lng, Math.max(30, 28 * mppEn(ll.lat))); if (!pt) { aviso('No hay ninguna calle cerca de ese punto'); return; } }
  else pt = { lat: ll.lat, lon: ll.lng };
  const last = d.wps[d.wps.length - 1]; let leg = { path: [[pt.lat, pt.lon]], tramos: [] };
  if (last) {
    const recta = { path: [[last.lat, last.lon], [pt.lat, pt.lon]], tramos: [{ name: '', pts: [[last.lat, last.lon], [pt.lat, pt.lon]] }] };
    if (last.e !== undefined && pt.e !== undefined) { leg = route(last, pt); if (!leg) { aviso('Esos puntos no están conectados por calles: se unen en línea recta'); leg = recta; } } else leg = recta;
  }
  d.wps.push(pt); d.legs.push(leg); render(); redibujar();
}
function cerrarTramo(d) {
  const ok = d.wps.length >= 2;
  if (ok) d.segs.push({ path: curPath(d), tramos: unir(d.legs.flatMap(l => l.tramos)) });
  d.wps = []; d.legs = []; return ok;
}
function puntoMedio(pts) {
  const tot = lengthM(pts); let acum = 0;
  for (let i = 1; i < pts.length; i++) { const dd = lengthM([pts[i - 1], pts[i]]); if (acum + dd >= tot / 2) { const u = dd ? (tot / 2 - acum) / dd : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u]; } acum += dd; }
  return pts[0];
}
const ABREV = [[/^Calle\s+/i, 'C/ '], [/^Avenida\s+/i, 'Avda. '], [/^Carretera\s+/i, 'Ctra. '], [/^Plaza\s+/i, 'Pza. '], [/^Paseo\s+/i, 'Pº '], [/^Traves[ií]a\s+/i, 'Trv. '], [/^Camino\s+/i, 'Cno. '], [/^Callej[oó]n\s+/i, 'Cjón. '], [/^Glorieta\s+/i, 'Gta. ']];
const textoCalle = n => (S.abreviar ? ABREV.reduce((s, [re, ab]) => s.replace(re, ab), n) : n);
function etiquetasDe(tramos) {
  const mejor = new Map();
  for (const t of tramos) { if (!t.name) continue; const L = lengthM(t.pts), b = mejor.get(t.name); if (!b || L > b.L) mejor.set(t.name, { t, L }); }
  return tramos.filter(t => { const b = t.name && mejor.get(t.name); return b && b.t === t && b.L >= 50; }).map(t => { const [la, lo] = puntoMedio(t.pts); return nuevaEtiqueta(textoCalle(t.name), la, lo); });
}
const PRESETS = {
  itinerario: { nombre: 'Itinerario', estilo: { color: '#16a34a', ancho: 7, borde: true, discontinuo: false, flechas: { on: true, color: '#1d5fb5', tam: 20, sep: 220 } } },
  corte: { nombre: 'Corte', estilo: { color: '#d92d20', ancho: 7, borde: true, discontinuo: false, flechas: { on: false, color: '#d92d20', tam: 20, sep: 220 } } },
  desvio: { nombre: 'Desvío', estilo: { color: '#16a34a', ancho: 6, borde: false, discontinuo: true, flechas: { on: true, color: '#16a34a', tam: 20, sep: 200 } } },
};
const aplicarPreset = (t, k) => Object.assign(t, JSON.parse(JSON.stringify(PRESETS[k].estilo)));
function marcasAuto(t, k) {
  const pts = t.segs.flat(); if (!pts.length) return []; const a = pts[0], z = pts[pts.length - 1];
  if (k === 'itinerario') return [nuevaMarca('salida', a[0], a[1]), ...(lengthM([a, z]) > 60 ? [nuevaMarca('meta', z[0], z[1])] : [])];
  if (k === 'corte') return [nuevaMarca('prohibido', a[0], a[1]), nuevaMarca('prohibido', z[0], z[1])];
  return [];
}
function terminarDibujo() {
  const d = S.dib; cerrarTramo(d);
  if (!d.segs.length) { aviso('Marca al menos dos puntos'); return; }
  const t = nuevoTrazo(S.p.trazos.length + 1); t.segs = d.segs.map(s => s.path); t.etiquetas = etiquetasDe(d.segs.flatMap(s => s.tramos));
  if (!d.rehacer) { aplicarPreset(t, S.preset); const n = S.p.trazos.filter(x => x.nombre.startsWith(PRESETS[S.preset].nombre)).length; t.nombre = PRESETS[S.preset].nombre + (n ? ' ' + (n + 1) : ''); if (S.autoMarcas) S.p.marcas.push(...marcasAuto(t, S.preset)); }
  if (d.rehacer) { const o = S.p.trazos.find(x => x.id === d.rehacer); if (o) { o.segs = t.segs; o.etiquetas = t.etiquetas; S.dib = null; S.sel = { trazo: o.id, label: null }; guardar(); render(); redibujar(); return; } }
  S.p.trazos.push(t); S.dib = null; S.hover = null; S.sel = { ...selVacio(), trazo: t.id }; guardar(); render(); redibujar();
  aviso(t.etiquetas.length ? `Trazo creado con ${t.etiquetas.length} nombres de calle. Ajústalos en «Nombres».` : 'Trazo creado.');
}
function cancelarDibujo() { S.dib = null; S.hover = null; render(); redibujar(); }

/* ───────── Interacción con el mapa ───────── */
const fijarSel = el => {
  if (el.k === 'label') { S.sel = { ...selVacio(), trazo: el.tid, label: el.id }; S.tab = 'nombres'; }
  else if (el.k === 'marca') { S.sel = { ...selVacio(), marca: el.id }; S.tab = 'senales'; }
  else { S.sel = { ...selVacio(), nota: el.id }; S.tab = 'senales'; }
};
function colocarAqui(ll) {
  const c = S.colocar; S.colocar = c.k === 'sinflecha' ? c : null;
  if (c.k === 'label') { const t = selTrazoObj(); if (!t) return; const l = nuevaEtiqueta('NOMBRE', ll.lat, ll.lng); t.etiquetas.push(l); S.sel = { ...S.sel, label: l.id }; }
  else if (c.k === 'marca') { const m = nuevaMarca(c.tipo, ll.lat, ll.lng); if (REFERENCIAS[c.tipo]) m.tam = 64; S.p.marcas.push(m); S.sel = { ...selVacio(), marca: m.id }; }
  else if (c.k === 'sinflecha') { const t = selTrazoObj(); if (!t) return; t.flechas.sin = [...(t.flechas.sin || []), { lat: ll.lat, lon: ll.lng, r: S.radioZona }]; }
  else if (c.k === 'nota') { const n = nuevaNota(ll.lat, ll.lng); S.p.notas.push(n); S.sel = { ...selVacio(), nota: n.id }; }
  guardar(); render(); redibujar();
}
map.on('click', ev => {
  if (S.suprimir) { S.suprimir = false; return; }
  if (S.dib) { addPunto(ev.latlng); return; }
  if (S.colocar) { colocarAqui(ev.latlng); return; }
  const p = ev.containerPoint, el = elementoEn(hits, p.x, p.y, S.sel);
  if (el) { fijarSel(el); render(); redibujar(); return; }
  const t = trazoEn(hits, p.x, p.y);
  if (t) { S.sel = { ...selVacio(), trazo: t }; if (S.tab === 'plano' || S.tab === 'senales') S.tab = 'trazos'; render(); redibujar(); return; }
  S.sel = selVacio(); render(); redibujar();
});
map.on('mousemove', ev => {
  if (!S.dib || S.dib.modo !== 'calles' || !net.ready) return;
  if (map._h) return; map._h = true;
  requestAnimationFrame(() => { map._h = false; S.hover = snap(ev.latlng.lat, ev.latlng.lng, Math.max(30, 28 * mppEn(ev.latlng.lat))); redibujar(); });
});
/* arrastrar nombres, señales y cuadros de texto para colocarlos donde se quiera */
const objetoArrastrado = d => (d.k === 'label' ? buscarEt(d.id) : d.k === 'marca' ? S.p.marcas.find(x => x.id === d.id) : S.p.notas.find(x => x.id === d.id));
cont.addEventListener('pointerdown', ev => {
  if (S.dib || S.colocar || ev.button > 0 || ev.target.closest('.leaflet-control')) return;
  const r = cont.getBoundingClientRect(), el = elementoEn(hits, ev.clientX - r.left, ev.clientY - r.top, S.sel); if (!el) return;
  map.dragging.disable(); S.drag = { ...el, moved: false }; if (el.k !== 'ancla') fijarSel(el);
  try { cont.setPointerCapture(ev.pointerId); } catch { /* sin captura */ } ev.preventDefault();
}, true);
cont.addEventListener('pointermove', ev => {
  if (!S.drag) return; const r = cont.getBoundingClientRect(), ll = map.containerPointToLatLng([ev.clientX - r.left, ev.clientY - r.top]);
  if (S.drag.k === 'ancla') { const n = S.p.notas.find(x => x.id === S.drag.id); if (!n) return; n.ancla = { lat: ll.lat, lon: ll.lng }; }
  else { const o = objetoArrastrado(S.drag); if (!o) return; o.lat = ll.lat; o.lon = ll.lng; }
  S.drag.moved = true; redibujar();
});
const finArrastre = () => {
  if (!S.drag) return; map.dragging.enable();
  if (S.drag.moved) { guardar(); S.suprimir = true; setTimeout(() => { S.suprimir = false; }, 60); }
  S.drag = null; render(); redibujar();
};
cont.addEventListener('pointerup', finArrastre); cont.addEventListener('pointercancel', finArrastre);
cont.addEventListener('pointerup', finArrastre); cont.addEventListener('pointercancel', finArrastre);
function quitarSel() {
  if (S.sel.label) { quitarEtiqueta(S.sel.label); return; }
  if (S.sel.marca) { S.p.marcas = S.p.marcas.filter(m => m.id !== S.sel.marca); S.sel.marca = null; }
  else if (S.sel.nota) { S.p.notas = S.p.notas.filter(n => n.id !== S.sel.nota); S.sel.nota = null; }
  else return; guardar(); render(); redibujar();
}
document.addEventListener('keydown', ev => {
  if (/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
  const ctrl = ev.ctrlKey || ev.metaKey, k = ev.key.toLowerCase();
  if (ev.key === 'Escape') { if (S.dib) cancelarDibujo(); S.colocar = null; render(); }
  if (ev.key === 'Delete' || ev.key === 'Backspace') quitarSel();
  if (ctrl && k === 'z') { ev.preventDefault(); if (S.dib) deshacer(); else if (ev.shiftKey) rehacerProy(); else deshacerProy(); }
  if (ctrl && k === 'y') { ev.preventDefault(); rehacerProy(); }
});
function deshacer() { const d = S.dib; if (d.wps.length) { d.wps.pop(); d.legs.pop(); } else if (d.segs.length) d.segs.pop(); render(); redibujar(); }
function quitarEtiqueta(id) { for (const t of S.p.trazos) t.etiquetas = t.etiquetas.filter(l => l.id !== id); if (S.sel.label === id) S.sel.label = null; guardar(); render(); redibujar(); }

/* ───────── Marco de exportación ───────── */
function actualizarMarco() {
  const m = $('#marco'), on = S.tab === 'exportar' && S.marco.on && !S.dib; m.hidden = !on; if (!on) return;
  const sz = map.getSize(), asp = S.marco.w / S.marco.h; let w = sz.x * 0.88, h = w / asp; if (h > sz.y * 0.88) { h = sz.y * 0.88; w = h * asp; }
  m.style.width = w + 'px'; m.style.height = h + 'px'; S.marco.px = { w, h };
}

/* ───────── Paneles ───────── */
const panel = $('#panel');
const rg = (o, k, label, min, max, step, val, id = '') => `<label class="rg"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-o="${o}" data-k="${k}" data-ty="n"${id ? ` data-id="${id}"` : ''}><output>${val}</output></label>`;
const cl = (o, k, label, val, id = '') => `<label class="cl"><span>${label}</span><input type="color" value="${val}" data-o="${o}" data-k="${k}"${id ? ` data-id="${id}"` : ''}></label>`;
const ck = (o, k, label, val, id = '') => `<label class="ck"><input type="checkbox" ${val ? 'checked' : ''} data-o="${o}" data-k="${k}" data-ty="b"${id ? ` data-id="${id}"` : ''}><span>${label}</span></label>`;
const swatches = (o, k, val) => `<div class="sws">${PALETA.map(c => `<button type="button" class="sw${val === c ? ' on' : ''}" style="background:${c}" data-act="color" data-o="${o}" data-k="${k}" data-v="${c}" aria-label="Color ${c}"></button>`).join('')}</div>`;

function vistaPlano() {
  const g = S.p.gris, B = [['gris', 'Gris y blanco (personalizable)'], ['tierra', 'Beige (tonos tierra)'], ['osm', 'Calles (OpenStreetMap)'], ['sat', 'Satélite (PNOA)']];
  return `<h3>Fondo del plano</h3>
    <select class="txt" data-base="1" aria-label="Fondo del plano">${B.map(([k, l]) => `<option value="${k}"${S.p.base === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
    ${S.p.base === 'gris' ? `<div class="card grp">${cl('g', 'fondo', 'Color del fondo', g.fondo)}${cl('g', 'calle', 'Color de las calles', g.calle)}${rg('g', 'ancho', 'Grosor de las calles', 0.5, 2, 0.05, g.ancho)}<button class="btn" data-act="gris-def">Restablecer colores</button></div>` : `<p class="mut small">${S.p.base === 'tierra' ? 'Estilo fijo (fondo crema, manzanas en arena, calles blancas, vías principales amarillentas y zonas verdes de OpenStreetMap: parques, jardines y césped). También sale en la imagen descargada.' : 'La descarga de imagen solo está disponible con los fondos «Gris y blanco» y «Beige». Con calles o satélite, usa la captura de pantalla.'}</p>`}
    <h3>Callejero de Don Benito</h3><p class="mut small">${esc(S.netTxt)}</p><button class="btn" data-act="red-calles">Descargar de nuevo</button>
    <h3>Ir a una calle</h3><input id="irCalle" class="txt" list="listaCalles" placeholder="Escribe el nombre de la calle…" autocomplete="off"><datalist id="listaCalles"></datalist>`;
}
function vistaTrazos() {
  const t = selTrazoObj();
  return `<button class="btn pri big" data-act="nuevo">＋ Nuevo trazo</button>
    ${S.p.trazos.length ? `<div class="lista">${S.p.trazos.map(x => `<div class="fila${x.id === S.sel.trazo ? ' on' : ''}" data-act="selt" data-id="${x.id}"><i style="background:${x.color}"></i><b>${esc(x.nombre)}</b><button class="ico" data-act="vist" data-id="${x.id}" title="${x.visible === false ? 'Mostrar' : 'Ocultar'}">${x.visible === false ? '◌' : '●'}</button></div>`).join('')}</div>` : '<p class="vacio">Aún no hay ningún trazo. Pulsa «Nuevo trazo», marca el inicio y el final del recorrido y seguirá la forma de las calles.</p>'}
    ${t ? `<h3>${esc(t.nombre)}</h3><div class="card">
      <label class="txtl"><span>Nombre</span><input class="txt" value="${esc(t.nombre)}" data-o="t" data-k="nombre" data-ty="s" data-re="1"></label>
      <div class="lbl">Estilo rápido</div><div class="seg">${Object.entries(PRESETS).map(([k, p]) => `<button data-act="preset-t" data-p="${k}">${p.nombre}</button>`).join('')}</div>
      <div class="lbl">Color</div>${swatches('t', 'color', t.color)}${cl('t', 'color', 'Otro color', t.color)}
      ${rg('t', 'ancho', 'Grosor', 2, 26, 1, t.ancho)}
      <div class="dos">${ck('t', 'borde', 'Borde blanco', t.borde !== false)}${ck('t', 'discontinuo', 'Discontinuo', t.discontinuo)}</div>
      <h3>Flechas de sentido</h3>${ck('fl', 'on', 'Mostrar flechas', t.flechas.on)}
      ${t.flechas.on ? ck('fl', 'doble', 'Doble sentido (flecha con dos puntas)', t.flechas.doble) : ''}
      ${t.flechas.on ? `${cl('fl', 'color', 'Color de la flecha', t.flechas.color)}${rg('fl', 'tam', 'Tamaño', 8, 44, 1, t.flechas.tam)}${rg('fl', 'sep', 'Separación', 80, 520, 10, t.flechas.sep)}
        <div class="lbl">Quitar flechas de una zona</div>${rg('au', 'radioZona', 'Radio (m)', 5, 100, 5, S.radioZona)}
        <button class="btn${S.colocar && S.colocar.k === 'sinflecha' ? ' pri' : ''}" data-act="sinflecha">${S.colocar && S.colocar.k === 'sinflecha' ? 'Terminar' : '✕ Marcar zona en el mapa'}</button>
        ${S.colocar && S.colocar.k === 'sinflecha' ? '<div class="hint">Pulsa en el mapa sobre la glorieta o el punto donde sobran flechas. Puedes marcar varias.</div>' : ''}
        ${(t.flechas.sin || []).length ? `<div class="lista">${t.flechas.sin.map((z, i) => `<div class="fila"><b>Zona ${i + 1} · ${z.r} m</b><button class="ico dng" data-act="sinflecha-del" data-i="${i}" title="Quitar zona" aria-label="Quitar zona">✕</button></div>`).join('')}</div>` : ''}` : ''}</div>
      <div class="btns"><button class="btn" data-act="rehacer">Volver a dibujar</button><button class="btn" data-act="dupt">Duplicar</button><button class="btn dng" data-act="delt" data-id="${t.id}">Eliminar</button></div>` : ''}`;
}
function vistaDibujo() {
  const d = S.dib, tramos = d.segs.length + (d.wps.length > 1 ? 1 : 0);
  const msg = !d.wps.length ? (d.segs.length ? 'Pulsa donde empieza el siguiente tramo, o «Terminar».' : 'Pulsa en el mapa el punto de inicio del recorrido.') : 'Pulsa el siguiente punto. Si la ruta no va por la calle que quieres, añade puntos intermedios.';
  return `<h2>Dibujando un trazo</h2>
    <div class="seg"><button data-act="modo" data-m="calles" class="${d.modo === 'calles' ? 'on' : ''}" ${net.ready ? '' : 'disabled'}>Siguiendo calles</button><button data-act="modo" data-m="libre" class="${d.modo === 'libre' ? 'on' : ''}">Libre</button></div>
    ${d.rehacer ? '' : `<div class="lbl">Tipo de trazo</div><div class="seg">${Object.entries(PRESETS).map(([k, p]) => `<button data-act="preset-nuevo" data-p="${k}" class="${S.preset === k ? 'on' : ''}">${p.nombre}</button>`).join('')}</div>${ck('au', 'autoMarcas', S.preset === 'corte' ? 'Señal de dirección prohibida en los extremos' : S.preset === 'itinerario' ? 'Punto de salida y meta' : 'Señales automáticas', S.autoMarcas)}`}
    <div class="hint">${msg}</div><p class="mut small">Puntos: ${d.wps.length} · Tramos: ${tramos}</p>
    <div class="btns"><button class="btn" data-act="undo">↶ Deshacer</button><button class="btn" data-act="newseg" ${d.wps.length >= 2 ? '' : 'disabled'}>Levantar el lápiz</button></div>
    <div class="btns"><button class="btn" data-act="cancelar">Cancelar</button><button class="btn pri" data-act="terminar" ${(d.segs.length || d.wps.length >= 2) ? '' : 'disabled'}>Terminar ›</button></div>`;
}
function vistaNombres() {
  const t = selTrazoObj(); if (!t) return '<p class="vacio">Selecciona un trazo (en la lista o pulsándolo en el mapa) para editar sus nombres de calle.</p>';
  const l = S.sel.label && buscarEt(S.sel.label);
  return `<h3>Nombres de «${esc(t.nombre)}»</h3>
    <div class="btns"><button class="btn" data-act="colocar">＋ Añadir nombre</button><button class="btn" data-act="cartel-todos" title="Aplica el estilo de cartel (azul, mayúsculas, borde blanco) a todos">Estilo cartel</button></div>
    ${S.colocar ? '<div class="hint">Pulsa en el mapa donde quieras el nombre.</div>' : ''}
    ${t.etiquetas.length ? `<div class="lista">${t.etiquetas.map(x => `<div class="fila${x.id === S.sel.label ? ' on' : ''}"><label class="vis"><input type="checkbox" ${x.visible !== false ? 'checked' : ''} data-o="lab" data-id="${x.id}" data-k="visible" data-ty="b" title="Mostrar u ocultar"></label><input class="txt" value="${esc(x.texto)}" data-o="lab" data-id="${x.id}" data-k="texto" data-ty="s" data-foco="${x.id}"><button class="ico" data-act="sell" data-id="${x.id}" title="Editar estilo">✎</button></div>`).join('')}</div>` : '<p class="vacio">Este trazo no tiene nombres. Añade uno o vuelve a dibujarlo siguiendo calles.</p>'}
    ${l ? `<h3>Estilo del nombre</h3><div class="card">
      ${rg('lab', 'tam', 'Tamaño', 8, 40, 1, l.tam, l.id)}${cl('lab', 'color', 'Color del texto', l.color, l.id)}${cl('lab', 'halo', 'Color del borde', l.halo, l.id)}
      ${rg('lab', 'giro', 'Giro (°)', -90, 90, 1, l.giro, l.id)}
      <div class="dos">${ck('lab', 'negrita', 'Negrita', l.negrita, l.id)}${ck('lab', 'mayus', 'MAYÚSCULAS', l.mayus, l.id)}</div></div>
      <div class="btns"><button class="btn" data-act="estilo-todos">Usar en todos</button><button class="btn dng" data-act="quitar-et" data-id="${l.id}">Quitar</button></div>` : ''}
    <label class="ck sep"><input type="checkbox" id="abrev" ${S.abreviar ? 'checked' : ''}><span>Abreviar al crear (C/, Avda., Pza., Pº, Trv., Cno.)</span></label>
    <p class="mut small">Arrastra un nombre en el mapa para moverlo. El giro se suma a la dirección de la calle.</p>`;
}
const iconos = {};
function icono(tipo) { if (!iconos[tipo]) { const c = document.createElement('canvas'); c.width = c.height = 88; dibujarSenal(c.getContext('2d'), tipo, 44, 46, 66, 1); iconos[tipo] = c.toDataURL(); } return iconos[tipo]; }
function vistaSenales() {
  const m = S.sel.marca && S.p.marcas.find(x => x.id === S.sel.marca), n = S.sel.nota && S.p.notas.find(x => x.id === S.sel.nota), L = S.p.leyenda, col = S.colocar;
  const items = [...S.p.marcas.map(x => ({ k: 'marca', id: x.id, t: SENALES[x.tipo] + (x.texto ? ' · ' + x.texto : ''), ic: icono(x.tipo) })), ...S.p.notas.map(x => ({ k: 'nota', id: x.id, t: x.texto.split('\n')[0], ic: '' }))];
  return `<h3>Señales de tráfico</h3><div class="pal">${Object.entries(TRAFICO).map(([k, l]) => `<button class="pb${col && col.tipo === k ? ' on' : ''}" data-act="poner" data-tipo="${k}"><img src="${icono(k)}" alt="" width="44" height="44"><span>${l}</span></button>`).join('')}</div>
    <h3>Puntos de referencia</h3><div class="pal">${Object.entries(REFERENCIAS).map(([k, l]) => `<button class="pb${col && col.tipo === k ? ' on' : ''}" data-act="poner" data-tipo="${k}"><img src="${icono(k)}" alt="" width="44" height="44"><span>${l}</span></button>`).join('')}</div>
    ${col && col.k === 'marca' ? `<div class="hint">Pulsa en el mapa donde quieras la señal de «${SENALES[col.tipo]}».</div>` : ''}
    <h3>Cuadro de texto</h3><button class="btn" data-act="poner-nota">＋ Añadir cuadro de texto</button>${col && col.k === 'nota' ? '<div class="hint">Pulsa en el mapa donde quieras el cuadro.</div>' : ''}
    ${m ? `<h3>Señal seleccionada</h3><div class="card">${rg('ma', 'tam', 'Tamaño', 20, 120, 2, m.tam)}${rg('ma', 'rot', 'Giro (°)', -180, 180, 5, m.rot || 0)}<div class="btns"><button class="btn" data-act="giro" data-g="-90">⟲ 90°</button><button class="btn" data-act="giro" data-g="90">⟳ 90°</button><button class="btn" data-act="giro" data-g="0">Recto</button></div><label class="txtl"><span>Texto debajo (opcional)</span><input class="txt" value="${esc(m.texto)}" data-o="ma" data-k="texto" data-ty="s" placeholder="Ej.: C/ San Francisco"></label>${m.texto ? `${rg('ma', 'ttam', 'Tamaño del texto', 8, 30, 1, m.ttam)}${cl('ma', 'color', 'Color del texto', m.color)}` : ''}</div><div class="btns"><button class="btn dng" data-act="quitar-sel">Quitar señal</button></div>` : ''}
    ${n ? `<h3>Cuadro seleccionado</h3><div class="card"><label class="txtl"><span>Texto (una línea por renglón)</span><textarea class="txt" rows="3" data-o="no" data-k="texto" data-ty="s">${esc(n.texto)}</textarea></label>${rg('no', 'tam', 'Tamaño', 9, 40, 1, n.tam)}${cl('no', 'color', 'Color del texto', n.color)}${cl('no', 'fondo', 'Color del fondo', n.fondo)}${cl('no', 'borde', 'Color del borde', n.borde)}${rg('no', 'bw', 'Grosor del borde', 1, 8, 1, n.bw)}${ck('no', 'mayus', 'MAYÚSCULAS', n.mayus)}</div><div class="btns"><button class="btn" data-act="nota-ancla">${n.ancla ? 'Quitar la flecha' : 'Añadir flecha a un punto'}</button><button class="btn dng" data-act="quitar-sel">Quitar cuadro</button></div>${n.ancla ? '<p class="mut small">Arrastra el círculo del extremo de la flecha hasta el punto que quieres señalar.</p>' : ''}` : ''}
    ${items.length ? `<h3>En el plano</h3><div class="lista">${items.map(x => `<div class="fila${(x.k === 'marca' ? S.sel.marca : S.sel.nota) === x.id ? ' on' : ''}" data-act="sel-el" data-k="${x.k}" data-id="${x.id}">${x.ic ? `<img src="${x.ic}" width="26" height="26" alt="">` : '<i style="background:#1d5fb5"></i>'}<b>${esc(x.t)}</b></div>`).join('')}</div>` : ''}
    <h3>Leyenda</h3>${ck('le', 'on', 'Mostrar leyenda en el plano', L.on)}
    ${L.on ? `<div class="card"><label class="txtl"><span>Posición</span><select class="txt" data-o="le" data-k="esq" data-ty="s">${[['ai', 'Arriba a la izquierda'], ['ad', 'Arriba a la derecha'], ['bi', 'Abajo a la izquierda'], ['bd', 'Abajo a la derecha']].map(([k, l]) => `<option value="${k}"${L.esq === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="lbl">Qué aparece</div>${filasLeyenda(S.p).map(f => `<label class="ck"><input type="checkbox" data-lk="${esc(f.key)}" ${(L.ocultos || []).includes(f.key) ? '' : 'checked'}><span>${esc(f.txt)}</span></label>`).join('') || '<p class="mut small">Aún no hay nada que mostrar.</p>'}
      ${rg('le', 'tam', 'Tamaño del texto', 10, 30, 1, L.tam)}${cl('le', 'borde', 'Color del borde', L.borde)}<p class="mut small">Se rellena sola con los trazos, el sentido de la marcha y las señales usadas; desmarca lo que no quieras. Se coloca dentro del marco de la pestaña Exportar.</p></div>` : ''}`;
}
function vistaExportar() {
  const f = S.marco, gris = S.p.base === 'gris' || S.p.base === 'tierra', bib = leerBib(), enLista = !!S.p.libId && bib.some(x => x.id === S.p.libId);
  return `<h3>Imagen para redes</h3>
    <div class="seg g2">${FORMATOS.map(([k, l]) => `<button data-act="fmt" data-f="${k}" class="${f.fmt === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    ${ck('mar', 'on', 'Mostrar el marco en el mapa', f.on)}
    <p class="mut small">Mueve y acerca el mapa para que lo que quieres quede dentro del marco. Se descargará solo esa zona.</p>
    <div class="btns"><button class="btn" data-act="encuadrar">Encuadrar el plano</button><button class="btn" data-act="copiar" ${gris ? '' : 'disabled'}>Copiar imagen</button></div>
    <button class="btn pri big" data-act="png" ${gris ? '' : 'disabled'}>Descargar PNG</button>
    ${gris ? '' : '<p class="mut small">Cambia a «Gris y blanco» o «Beige» en la pestaña Plano para descargar la imagen.</p>'}
    <h3>Mis planos</h3>
    <div class="card"><button class="btn pri big" data-act="bib-guardar">${enLista ? 'Actualizar en «Mis planos»' : 'Guardar en «Mis planos»'}</button>
      <p class="mut small">${enLista ? 'Este plano está en la lista y se actualiza solo con cada cambio, incluida la zona del mapa.' : 'Ponle un nombre claro arriba y guárdalo. Después se mantiene al día solo y podrás volver a él cuando quieras.'}</p></div>
    ${bib.length ? `<div class="lista">${bib.map(e => `<div class="fila${e.id === S.p.libId ? ' on' : ''}" data-act="bib-abrir" data-id="${e.id}" title="Abrir este plano"><div class="pl"><b>${esc(e.nombre)}</b><small>${esc(fechaCorta(e.fecha))} · ${e.p.trazos.length} trazo${e.p.trazos.length === 1 ? '' : 's'}</small></div><button class="ico" data-act="bib-dup" data-id="${e.id}" title="Duplicar" aria-label="Duplicar">⧉</button><button class="ico dng" data-act="bib-borrar" data-id="${e.id}" title="Borrar" aria-label="Borrar">✕</button></div>`).join('')}</div>` : '<p class="vacio">Todavía no has guardado ningún plano.</p>'}
    <h3>Archivo y plano nuevo</h3>
    <div class="btns"><button class="btn" data-act="guardar-arch">Guardar archivo</button><button class="btn" data-act="abrir-arch">Abrir archivo</button><button class="btn dng" data-act="nuevo-proy">Plano nuevo</button></div>
    <p class="mut small">El archivo (.json) sirve de copia de seguridad o para llevar el plano a otro equipo.</p>`;
}
const ICONOS_TAB = { plano: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>', trazos: '<path d="M4 19c5 0 3-7 8-7s3-7 8-7"/><circle cx="4" cy="19" r="1.5"/><circle cx="20" cy="5" r="1.5"/>', nombres: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>', senales: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.4"/>', exportar: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>' };
const TABS = [['plano', 'Plano'], ['trazos', 'Trazos'], ['nombres', 'Nombres'], ['senales', 'Señales'], ['exportar', 'Exportar']];
function render() {
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button data-act="tab" data-t="${k}" class="${S.tab === k && !S.dib ? 'on' : ''}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS_TAB[k]}</svg><span>${l}</span></button>`).join('');
  $('#tabs').hidden = !!S.dib;
  panel.innerHTML = S.dib ? vistaDibujo() : ({ plano: vistaPlano, trazos: vistaTrazos, nombres: vistaNombres, senales: vistaSenales, exportar: vistaExportar })[S.tab]();
  $('#nombre').value = S.p.nombre; actualizarMarco();
}

/* ───────── Acciones ───────── */
const ruta = (o, id) => ({ g: () => S.p.gris, p: () => S.p, t: selTrazoObj, fl: () => (selTrazoObj() || {}).flechas, lab: () => buscarEt(id), mar: () => S.marco, au: () => S, le: () => S.p.leyenda, ma: () => S.p.marcas.find(x => x.id === S.sel.marca), no: () => S.p.notas.find(x => x.id === S.sel.nota) })[o]();
const fijar = (obj, k, v) => { obj[k] = v; };
panel.addEventListener('input', ev => {
  const e = ev.target;
  if (e.id === 'irCalle') { $('#listaCalles').innerHTML = searchStreets(e.value).map(n => `<option value="${esc(n)}">`).join(''); const b = streetBounds(e.value); if (b) map.fitBounds(b, { padding: [40, 40], maxZoom: 18 }); return; }
  if (e.dataset.base) { S.p.base = e.value; aplicarBase(); guardar(); render(); return; }
  if (e.id === 'abrev') { S.abreviar = e.checked; return; }
  if (e.dataset.lk) { const L = S.p.leyenda, oc = (L.ocultos || []).filter(x => x !== e.dataset.lk); if (!e.checked) oc.push(e.dataset.lk); L.ocultos = oc; guardar(); redibujar(); return; }
  if (!e.dataset.o) return;
  const obj = ruta(e.dataset.o, e.dataset.id); if (!obj) return;
  const v = e.type === 'checkbox' ? e.checked : (e.dataset.ty === 'n' ? +e.value : e.value);
  fijar(obj, e.dataset.k, v);
  if (e.type === 'range') { const o = e.parentElement.querySelector('output'); if (o) o.textContent = v; }
  if (e.dataset.o === 'g') { cont.style.background = S.p.base === 'gris' ? S.p.gris.fondo : ''; }
  if (e.dataset.o === 'p' && e.dataset.k === 'nombre') $('#nombre').value = v;
  guardar(); redibujar();
  if (e.type === 'checkbox' && ['fl', 'mar', 'le'].includes(e.dataset.o)) { if (e.dataset.o === 'mar') actualizarMarco(); render(); }
  if (e.type === 'color' && e.dataset.o === 't') { const s = panel.querySelectorAll('.sw'); s.forEach(b => b.classList.toggle('on', b.dataset.v === v)); const f = panel.querySelector('.fila.on i'); if (f) f.style.background = v; }
});
$('#nombre').addEventListener('input', ev => { S.p.nombre = ev.target.value; guardar(); });
const alClic = ev => {
  const b = ev.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, d = S.dib, t = selTrazoObj();
  switch (act) {
    case 'tab': S.tab = b.dataset.t; render(); redibujar(); break;
    case 'base': S.p.base = b.dataset.b; aplicarBase(); guardar(); render(); break;
    case 'gris-def': S.p.gris = nuevoProyecto().gris; aplicarBase(); guardar(); render(); break;
    case 'red-calles': loadNet(true, estadoCalles).then(() => { render(); redibujar(); }); if (S.p.base === 'tierra') loadVerdes(true).then(() => redibujar()); break;
    case 'nuevo': S.dib = nuevoBorrador(); S.sel = { trazo: S.sel.trazo, label: null }; render(); redibujar(); if (!net.ready) aviso('El callejero no está cargado: trazado libre'); break;
    case 'rehacer': if (t) { S.dib = nuevoBorrador(); S.dib.rehacer = t.id; render(); redibujar(); } break;
    case 'selt': S.sel = { trazo: b.dataset.id, label: null }; render(); redibujar(); { const x = S.p.trazos.find(q => q.id === b.dataset.id); if (x && x.segs.length) map.fitBounds(L.latLngBounds(x.segs.flat()), { padding: [60, 60], maxZoom: 18 }); } break;
    case 'vist': ev.stopPropagation(); { const x = S.p.trazos.find(q => q.id === b.dataset.id); if (x) x.visible = x.visible === false; } guardar(); render(); redibujar(); break;
    case 'delt': S.p.trazos = S.p.trazos.filter(x => x.id !== b.dataset.id); S.sel = { trazo: null, label: null }; guardar(); render(); redibujar(); break;
    case 'dupt': if (t) { const c = JSON.parse(JSON.stringify(t)); c.id = uid(); c.nombre += ' (copia)'; c.etiquetas.forEach(l => { l.id = uid(); }); S.p.trazos.push(c); S.sel = { trazo: c.id, label: null }; guardar(); render(); redibujar(); } break;
    case 'color': { const obj = ruta(b.dataset.o); if (obj) { obj[b.dataset.k] = b.dataset.v; guardar(); render(); redibujar(); } break; }
    case 'modo': d.modo = b.dataset.m; S.hover = null; render(); redibujar(); break;
    case 'undo': deshacer(); break;
    case 'newseg': cerrarTramo(d); render(); redibujar(); break;
    case 'cancelar': cancelarDibujo(); break;
    case 'terminar': terminarDibujo(); break;
    case 'colocar': S.colocar = { k: 'label' }; render(); break;
    case 'sinflecha': S.colocar = S.colocar && S.colocar.k === 'sinflecha' ? null : { k: 'sinflecha' }; render(); break;
    case 'sinflecha-del': if (t) { t.flechas.sin.splice(+b.dataset.i, 1); guardar(); render(); redibujar(); } break;
    case 'poner': S.colocar = { k: 'marca', tipo: b.dataset.tipo }; render(); break;
    case 'poner-nota': S.colocar = { k: 'nota' }; render(); break;
    case 'sel-el': S.sel = b.dataset.k === 'marca' ? { ...selVacio(), marca: b.dataset.id } : { ...selVacio(), nota: b.dataset.id }; render(); redibujar(); break;
    case 'quitar-sel': quitarSel(); break;
    case 'nota-ancla': { const n = S.p.notas.find(x => x.id === S.sel.nota); if (n) { if (n.ancla) n.ancla = null; else { const c = map.getCenter(); n.ancla = { lat: n.lat - 0.0005, lon: n.lon + 0.0004 }; } guardar(); render(); redibujar(); } break; }
    case 'esq': S.p.leyenda.esq = b.dataset.e; guardar(); render(); redibujar(); break;
    case 'preset-nuevo': S.preset = b.dataset.p; render(); break;
    case 'preset-t': if (t) { aplicarPreset(t, b.dataset.p); guardar(); render(); redibujar(); } break;
    case 'encuadrar': encuadrarTodo(); break;
    case 'copiar': copiarImagen(); break;
    case 'sell': S.sel.label = b.dataset.id; render(); redibujar(); break;
    case 'quitar-et': quitarEtiqueta(b.dataset.id); break;
    case 'cartel-todos': if (t) { t.etiquetas.forEach(l => Object.assign(l, ESTILO_CARTEL)); guardar(); render(); redibujar(); } break;
    case 'estilo-todos': { const l = S.sel.label && buscarEt(S.sel.label); if (t && l) { t.etiquetas.forEach(x => Object.assign(x, { tam: l.tam, color: l.color, halo: l.halo, negrita: l.negrita, mayus: l.mayus })); guardar(); redibujar(); aviso('Estilo aplicado a todos los nombres del trazo'); } break; }
    case 'fmt': { const [w, h] = b.dataset.f.split('x').map(Number); Object.assign(S.marco, { fmt: b.dataset.f, w, h }); render(); redibujar(); break; }
    case 'png': descargarPNG(); break;
    case 'giro': { const m = S.p.marcas.find(x => x.id === S.sel.marca); if (m) { const g = +b.dataset.g; m.rot = g ? ((((m.rot || 0) + g + 180) % 360) + 360) % 360 - 180 : 0; guardar(); render(); redibujar(); } break; }
    case 'bib-guardar': guardarEnBib(); break;
    case 'bib-abrir': abrirDeBib(b.dataset.id); break;
    case 'bib-dup': duplicarBib(b.dataset.id); break;
    case 'bib-borrar': if (b.dataset.ok) borrarDeBib(b.dataset.id); else { b.dataset.ok = '1'; b.textContent = '¿Seguro?'; setTimeout(() => { b.dataset.ok = ''; b.textContent = '✕'; }, 3000); } break;
    case 'guardar-arch': descargar(new Blob([JSON.stringify(S.p, null, 1)], { type: 'application/json' }), (S.p.nombre || 'plano') + '.json'); break;
    case 'abrir-arch': $('#fileProy').click(); break;
    case 'nuevo-proy': if (b.dataset.ok) { S.p = nuevoProyecto(); S.sel = { trazo: null, label: null }; guardar(); aplicarBase(); render(); redibujar(); } else { b.dataset.ok = '1'; b.textContent = 'Pulsa otra vez para borrar todo'; setTimeout(() => { b.dataset.ok = ''; b.textContent = 'Plano nuevo'; }, 3000); } break;
  }
};
panel.addEventListener('click', alClic); $('#tabs').addEventListener('click', alClic);
$('#fileProy').addEventListener('change', async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try { const j = JSON.parse(await f.text()); if (!j || !Array.isArray(j.trazos)) throw new Error('No es un plano'); delete j.libId; S.p = normalizar(j); S.sel = { trazo: null, label: null }; guardar(); aplicarBase(); render(); redibujar(); aviso('Plano abierto'); }
  catch (e) { aviso('No se pudo abrir el archivo: ' + e.message); }
});
function descargar(blob, nombre) { const a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = nombre.replace(/[\\/:*?"<>|]+/g, '-'); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 3000); }
function generar() {
  const f = S.marco; actualizarMarco(); if (!f.px.w) { aviso('Abre la pestaña Exportar y activa el marco'); return null; }
  const c = map.getCenter(), m = merc(c.lat, c.lng); return imagen(S.p, m[0], m[1], map.getZoom(), f.px.w, f.w, f.h);
}
function encuadrarTodo() {
  const pts = [...S.p.trazos.filter(t => t.visible !== false).flatMap(t => t.segs.flat()), ...S.p.marcas.map(m => [m.lat, m.lon]), ...S.p.notas.map(n => [n.lat, n.lon])];
  if (!pts.length) { aviso('No hay nada que encuadrar todavía'); return; }
  const sz = map.getSize(), f = S.tab === 'exportar' && S.marco.on && S.marco.px.w ? S.marco.px : { w: sz.x * 0.9, h: sz.y * 0.9 };
  const px = Math.max(30, (sz.x - f.w) / 2 + 40), py = Math.max(30, (sz.y - f.h) / 2 + 40);
  map.fitBounds(L.latLngBounds(pts), { paddingTopLeft: [px, py], paddingBottomRight: [px, py], maxZoom: 19 });
}
async function copiarImagen() {
  try { const cv = generar(); if (!cv) return; const b = await new Promise(r => cv.toBlob(r, 'image/png')); await navigator.clipboard.write([new ClipboardItem({ 'image/png': b })]); aviso('Imagen copiada: ya puedes pegarla'); }
  catch { aviso('El navegador no permite copiar la imagen. Usa «Descargar PNG».'); }
}
function descargarPNG() {
  const f = S.marco, cv = generar(); if (!cv) return;
  cv.toBlob(b => { if (!b) { aviso('No se pudo generar la imagen'); return; } descargar(b, (S.p.nombre || 'plano') + '.png'); aviso(`Imagen ${f.w}×${f.h} descargada`); }, 'image/png');
}

/* ───────── Arranque ───────── */
function estadoCalles(txt) { S.netTxt = txt; if (S.tab === 'plano' && !S.dib) { const e = panel.querySelector('.mut.small'); if (e && !panel.querySelector('#irCalle:focus')) render(); } }
aplicarBase(); render(); tomarFoto(); actualizarHist();
$('#btnUndo').onclick = deshacerProy; $('#btnRedo').onclick = rehacerProy;
loadNet(false, estadoCalles).then(() => { render(); redibujar(); });
window.__plano = { S, map, net, pintar: () => pintar(), hits: () => hits };
window.__appListo = true;

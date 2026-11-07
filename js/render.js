/* Motor de dibujo: el MISMO código pinta la pantalla y la imagen que se descarga. */
import { net, merc } from './net.js?v=20261108a';

export const FUENTE = '"Montserrat","Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';
export const ESTILO_CARTEL = { color: '#1d5fb5', halo: '#ffffff', negrita: true, mayus: true, tam: 14 };

/* Vista: centro Mercator (0..1), tamaño del mundo en píxeles S, tamaño del lienzo y factor de escala k */
export function crearVista(cx, cy, S, w, h, k = 1) {
  const lat = (2 * Math.atan(Math.exp(Math.PI * (1 - 2 * cy))) - Math.PI / 2) * 180 / Math.PI;
  return { cx, cy, S, w, h, k, mpp: 40075016.686 * Math.cos(lat * Math.PI / 180) / S, px: (mx, my) => [(mx - cx) * S + w / 2, (my - cy) * S + h / 2] };
}
const pxPath = (v, seg) => seg.map(q => { const m = merc(q[0], q[1]); return v.px(m[0], m[1]); });

/* ───────── Calles del plano gris ───────── */
function calles(ctx, v, p) {
  if (!net.ready) return;
  const vx0 = v.cx - v.w / 2 / v.S, vx1 = v.cx + v.w / 2 / v.S, vy0 = v.cy - v.h / 2 / v.S, vy1 = v.cy + v.h / 2 / v.S, anc = p.gris.ancho ?? 1;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = p.gris.calle; ctx.setLineDash([]);
  for (const m of [4.5, 7.5, 10, 13]) {
    ctx.lineWidth = Math.min(70 * v.k, Math.max(1.1 * v.k, m * anc / v.mpp));
    ctx.beginPath(); let hay = false;
    for (const l of net.rl) {
      if (l.m !== m) continue;
      const b = l.b; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      for (let i = 0; i < l.mx.length; i++) { const x = (l.mx[i] - v.cx) * v.S + v.w / 2, y = (l.my[i] - v.cy) * v.S + v.h / 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      hay = true;
    }
    if (hay) ctx.stroke();
  }
}

/* ───────── Flechas de sentido ───────── */
function flecha(ctx, x, y, ang, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const L = s * 1.5, sw = s * 0.42, hw = s, hl = s * 0.8;
  ctx.beginPath(); ctx.moveTo(-L / 2, -sw / 2); ctx.lineTo(L / 2 - hl, -sw / 2); ctx.lineTo(L / 2 - hl, -hw / 2); ctx.lineTo(L / 2, 0);
  ctx.lineTo(L / 2 - hl, hw / 2); ctx.lineTo(L / 2 - hl, sw / 2); ctx.lineTo(-L / 2, sw / 2); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
}
function flechas(ctx, v, t, segs) {
  const f = t.flechas, k = v.k, size = f.tam * k, sep = f.sep * k; if (sep < 8 || size < 2) return;
  ctx.fillStyle = f.color; ctx.strokeStyle = f.borde || '#ffffff'; ctx.lineWidth = 2 * k; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  for (const s of segs) {
    const cum = [0]; for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
    const total = cum[cum.length - 1]; let d = sep / 2, i = 1;
    while (d < total) {
      while (i < cum.length - 1 && cum[i] < d) i++;
      const a = s[i - 1], b = s[i], seg = cum[i] - cum[i - 1] || 1, u = (d - cum[i - 1]) / seg;
      flecha(ctx, a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0]), size); d += sep;
    }
  }
}

/* ───────── Trazos ───────── */
function trazo(ctx, v, t, ui, hits, cache) {
  const k = v.k, segs = t.segs.map(s => pxPath(v, s)), w = t.ancho * k; cache.set(t.id, segs);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  const trazar = () => { ctx.beginPath(); for (const s of segs) s.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); };
  if (ui.ui && ui.sel && ui.sel.trazo === t.id) { ctx.strokeStyle = 'rgba(29,95,181,.28)'; ctx.lineWidth = w + 16; trazar(); }
  if (t.borde !== false && !t.discontinuo) { ctx.strokeStyle = t.bordeColor || '#ffffff'; ctx.lineWidth = w + 5 * k; trazar(); }
  ctx.strokeStyle = t.color; ctx.lineWidth = w; if (t.discontinuo) ctx.setLineDash([w * 2.2, w * 1.6]); trazar(); ctx.setLineDash([]);
  if (t.flechas && t.flechas.on) flechas(ctx, v, t, segs);
  hits.trazos.push({ id: t.id, segs, w: Math.max(w, 16) });
}

/* ───────── Nombres de calles ───────── */
function angAuto(segs, x, y) {
  let best = 1e18, ang = 0;
  for (const s of segs) for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1;
    const u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)), d = (x - a[0] - u * dx) ** 2 + (y - a[1] - u * dy) ** 2;
    if (d < best) { best = d; ang = Math.atan2(dy, dx); }
  }
  let deg = ang * 180 / Math.PI; if (deg > 90) deg -= 180; if (deg < -90) deg += 180; return deg * Math.PI / 180;
}
function etiqueta(ctx, v, t, l, ui, hits, cache) {
  const k = v.k, m = merc(l.lat, l.lon), [x, y] = v.px(m[0], m[1]), size = l.tam * k;
  const lineas = (l.mayus ? String(l.texto).toUpperCase() : String(l.texto)).split('\n'), paso = size * 1.12, ang = angAuto(cache.get(t.id) || [], x, y) + (l.giro || 0) * Math.PI / 180;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.font = `${l.negrita ? 800 : 500} ${size}px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  let ancho = 0; lineas.forEach(s => { ancho = Math.max(ancho, ctx.measureText(s).width); });
  lineas.forEach((s, i) => {
    const yy = (i - (lineas.length - 1) / 2) * paso;
    ctx.shadowColor = 'rgba(0,0,0,.30)'; ctx.shadowBlur = 3 * k; ctx.shadowOffsetY = 1 * k; ctx.lineWidth = size * 0.3; ctx.strokeStyle = l.halo; ctx.strokeText(s, 0, yy);
    ctx.shadowColor = 'transparent'; ctx.fillStyle = l.color; ctx.fillText(s, 0, yy);
  });
  const h = paso * lineas.length;
  if (ui.ui && ui.sel && ui.sel.label === l.id) { ctx.strokeStyle = '#1d5fb5'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(-ancho / 2 - 6, -h / 2 - 3, ancho + 12, h + 6); }
  ctx.restore();
  hits.labels.push({ id: l.id, tid: t.id, cx: x, cy: y, w: ancho + 12, h: h + 6, ang });
}

/* ───────── Borrador del trazo que se está dibujando ───────── */
function borrador(ctx, v, b) {
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const linea = (pts, ancho, col, dash) => { if (pts.length < 2) return; ctx.beginPath(); pts.forEach((q, i) => { const m = merc(q[0], q[1]), [x, y] = v.px(m[0], m[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.setLineDash(dash || []); ctx.lineWidth = ancho; ctx.strokeStyle = col; ctx.stroke(); ctx.setLineDash([]); };
  b.segs.forEach(s => linea(s, 7, 'rgba(29,95,181,.9)'));
  linea(b.cur || [], 6, '#1d5fb5', [10, 7]);
  (b.wps || []).forEach((q, i) => { const m = merc(q.lat, q.lon), [x, y] = v.px(m[0], m[1]); ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = i === 0 ? '#12b76a' : '#1d5fb5'; ctx.stroke(); });
  if (b.hover) { const m = merc(b.hover.lat, b.hover.lon), [x, y] = v.px(m[0], m[1]); ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.strokeStyle = '#1d5fb5'; ctx.lineWidth = 2.5; ctx.stroke(); }
}

/* ───────── Dibujo completo ───────── */
export function dibujar(ctx, v, p, ui = {}) {
  const hits = { labels: [], trazos: [] }, cache = new Map();
  ctx.save(); ctx.clearRect(0, 0, v.w, v.h);
  if (p.base === 'gris') { ctx.fillStyle = p.gris.fondo; ctx.fillRect(0, 0, v.w, v.h); calles(ctx, v, p); }
  for (const t of p.trazos) if (t.visible !== false) trazo(ctx, v, t, ui, hits, cache);
  for (const t of p.trazos) if (t.visible !== false) for (const l of t.etiquetas) if (l.visible !== false) etiqueta(ctx, v, t, l, ui, hits, cache);
  if (ui.borrador) borrador(ctx, v, ui.borrador);
  ctx.restore(); return hits;
}

/* Distancia de un punto a los trazos, para seleccionar con un clic */
export function trazoEn(hits, x, y) {
  let mejor = null, dm = 1e9;
  for (const t of hits.trazos) for (const s of t.segs) for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, u = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2));
    const d = Math.hypot(x - a[0] - u * dx, y - a[1] - u * dy); if (d < t.w / 2 + 4 && d < dm) { dm = d; mejor = t.id; }
  }
  return mejor;
}
export function etiquetaEn(hits, x, y) {
  for (let i = hits.labels.length - 1; i >= 0; i--) {
    const l = hits.labels[i], dx = x - l.cx, dy = y - l.cy, c = Math.cos(-l.ang), s = Math.sin(-l.ang), rx = dx * c - dy * s, ry = dx * s + dy * c;
    if (Math.abs(rx) <= l.w / 2 + 4 && Math.abs(ry) <= l.h / 2 + 4) return l;
  }
  return null;
}

/* Imagen para descargar: región centrada del mapa, a la resolución pedida */
export function imagen(p, cx, cy, zoom, anchoPantalla, outW, outH) {
  const k = outW / anchoPantalla, c = document.createElement('canvas'); c.width = outW; c.height = outH;
  dibujar(c.getContext('2d'), crearVista(cx, cy, 256 * Math.pow(2, zoom) * k, outW, outH, k), p, {}); return c;
}

/* Motor de dibujo: el MISMO código pinta la pantalla y la imagen que se descarga. */
import { net, merc } from './net.js?v=20261108e';

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
function flechas(ctx, v, t, segs, evitar = []) {
  const f = t.flechas, k = v.k, size = f.tam * k, sep = f.sep * k; if (sep < 8 || size < 2) return;
  ctx.fillStyle = f.color; ctx.strokeStyle = f.borde || '#ffffff'; ctx.lineWidth = 2 * k; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  for (const s of segs) {
    const cum = [0]; for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
    const total = cum[cum.length - 1]; let d = sep / 2, i = 1;
    while (d < total) {
      while (i < cum.length - 1 && cum[i] < d) i++;
      const a = s[i - 1], b = s[i], seg = cum[i] - cum[i - 1] || 1, u = (d - cum[i - 1]) / seg;
      const ax = a[0] + (b[0] - a[0]) * u, ay = a[1] + (b[1] - a[1]) * u;
      if (!evitar.some(e => Math.hypot(e.x - ax, e.y - ay) < e.r + size * 0.6)) flecha(ctx, ax, ay, Math.atan2(b[1] - a[1], b[0] - a[0]), size);
      d += sep;
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
  if (t.flechas && t.flechas.on) flechas(ctx, v, t, segs, t.etiquetas.filter(l => l.visible !== false).map(l => { const m = merc(l.lat, l.lon), q = v.px(m[0], m[1]); return { x: q[0], y: q[1], r: String(l.texto).length * l.tam * k * 0.33 }; }));
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

/* ───────── Señales ───────── */
export const SENALES = { prohibido: 'Dirección prohibida', obras: 'Obras', peligro: 'Peligro', estacionar: 'Prohibido estacionar', salida: 'Salida / llegada', meta: 'Meta' };
const sombra = (ctx, k) => { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4 * k; ctx.shadowOffsetY = 1.5 * k; };
const sinSombra = ctx => { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0; };
function triangulo(ctx, s, k) {
  const h = s, w = s * 1.12;
  ctx.beginPath(); ctx.moveTo(0, -h * 0.56); ctx.lineTo(w / 2, h * 0.44); ctx.lineTo(-w / 2, h * 0.44); ctx.closePath();
  sombra(ctx, k); ctx.fillStyle = '#fff'; ctx.fill(); sinSombra(ctx);
  ctx.lineWidth = s * 0.12; ctx.strokeStyle = '#d92d20'; ctx.lineJoin = 'round'; ctx.stroke();
}
/* Dibuja una señal centrada en (x, y); s = tamaño en píxeles; k = escala (para sombras) */
export function dibujarSenal(ctx, tipo, x, y, s, k = 1, rot = 0) {
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot * Math.PI / 180); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; const r = s / 2;
  if (tipo === 'prohibido') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); sombra(ctx, k); ctx.fillStyle = '#d92d20'; ctx.fill(); sinSombra(ctx);
    ctx.lineWidth = s * 0.08; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.fillStyle = '#fff'; ctx.fillRect(-r * 0.64, -s * 0.085, r * 1.28, s * 0.17);
  } else if (tipo === 'estacionar') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); sombra(ctx, k); ctx.fillStyle = '#1d5fb5'; ctx.fill(); sinSombra(ctx);
    ctx.lineWidth = s * 0.14; ctx.strokeStyle = '#d92d20'; ctx.beginPath(); ctx.arc(0, 0, r - s * 0.07, 0, 7); ctx.stroke();
    ctx.lineWidth = s * 0.14; ctx.beginPath(); ctx.moveTo(-r * 0.62, -r * 0.62); ctx.lineTo(r * 0.62, r * 0.62); ctx.stroke();
    ctx.lineWidth = s * 0.05; ctx.strokeStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  } else if (tipo === 'peligro') {
    triangulo(ctx, s, k); ctx.fillStyle = '#101828';
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-s * 0.05, -s * 0.2, s * 0.1, s * 0.34, s * 0.04) : ctx.rect(-s * 0.05, -s * 0.2, s * 0.1, s * 0.34); ctx.fill();
    ctx.beginPath(); ctx.arc(0, s * 0.26, s * 0.06, 0, 7); ctx.fill();
  } else if (tipo === 'obras') {
    /* Triángulo rojo con borde blanco, interior amarillo y operario con pala */
    const tri = (f, dy = 0) => { const c = s * 0.1067; ctx.beginPath(); ctx.moveTo(0, c + (-s * 0.56 - c) * f + dy); ctx.lineTo(s * 0.56 * f, c + (s * 0.44 - c) * f + dy); ctx.lineTo(-s * 0.56 * f, c + (s * 0.44 - c) * f + dy); ctx.closePath(); };
    tri(1); sombra(ctx, k); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = s * 0.17; ctx.fill(); ctx.stroke(); sinSombra(ctx);
    tri(1); ctx.fillStyle = '#c8000a'; ctx.strokeStyle = '#c8000a'; ctx.lineWidth = s * 0.09; ctx.fill(); ctx.stroke();
    tri(0.66, s * 0.012); ctx.fillStyle = '#ffe600'; ctx.strokeStyle = '#ffe600'; ctx.lineWidth = s * 0.012; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000'; ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.arc(-s * 0.035, -s * 0.03, s * 0.05, 0, 7); ctx.fill();
    ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.moveTo(-s * 0.06, s * 0.04); ctx.lineTo(-s * 0.02, s * 0.17); ctx.stroke();
    ctx.lineWidth = s * 0.06; ctx.beginPath(); ctx.moveTo(-s * 0.02, s * 0.17); ctx.lineTo(-s * 0.1, s * 0.29); ctx.moveTo(-s * 0.02, s * 0.17); ctx.lineTo(s * 0.03, s * 0.29); ctx.stroke();
    ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(-s * 0.06, s * 0.06); ctx.lineTo(s * 0.04, s * 0.14); ctx.stroke();
    ctx.lineWidth = s * 0.028; ctx.beginPath(); ctx.moveTo(-s * 0.01, s * 0.08); ctx.lineTo(s * 0.12, s * 0.22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.1, s * 0.22); ctx.lineTo(s * 0.17, s * 0.2); ctx.lineTo(s * 0.15, s * 0.28); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s * 0.13, s * 0.3); ctx.lineTo(s * 0.18, s * 0.22); ctx.lineTo(s * 0.25, s * 0.21); ctx.lineTo(s * 0.31, s * 0.3); ctx.closePath(); ctx.fill();
  } else if (tipo === 'salida') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); sombra(ctx, k); ctx.fillStyle = '#fff'; ctx.fill(); sinSombra(ctx);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.74, 0, 7); ctx.fillStyle = '#16a34a'; ctx.fill(); ctx.lineWidth = s * 0.04; ctx.strokeStyle = '#0f7a37'; ctx.stroke();
  } else if (tipo === 'meta') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); sombra(ctx, k); ctx.fillStyle = '#fff'; ctx.fill(); sinSombra(ctx);
    ctx.save(); ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, 7); ctx.clip(); const c = r * 0.78 * 2 / 4;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { ctx.fillStyle = (i + j) % 2 ? '#fff' : '#101828'; ctx.fillRect(-r * 0.78 + i * c, -r * 0.78 + j * c, c, c); }
    ctx.restore(); ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, 7); ctx.lineWidth = s * 0.05; ctx.strokeStyle = '#101828'; ctx.stroke();
  }
  ctx.restore();
}
function marca(ctx, v, m, ui, hits) {
  const k = v.k, mm = merc(m.lat, m.lon), [x, y] = v.px(mm[0], mm[1]), s = m.tam * k;
  dibujarSenal(ctx, m.tipo, x, y, s, k, m.rot || 0);
  if (m.texto) {
    const size = (m.ttam || 13) * k, lineas = (m.mayus === false ? m.texto : m.texto.toUpperCase()).split('\n');
    ctx.save(); ctx.font = `800 ${size}px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    lineas.forEach((t, i) => { const yy = y + s * 0.62 + size * 0.7 + i * size * 1.12; ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 3 * k; ctx.shadowOffsetY = k; ctx.lineWidth = size * 0.3; ctx.strokeStyle = m.halo || '#fff'; ctx.strokeText(t, x, yy); ctx.shadowColor = 'transparent'; ctx.fillStyle = m.color || '#1d5fb5'; ctx.fillText(t, x, yy); });
    ctx.restore();
  }
  if (ui.ui && ui.sel && ui.sel.marca === m.id) { ctx.save(); ctx.strokeStyle = '#1d5fb5'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x, y, s / 2 + 7, 0, 7); ctx.stroke(); ctx.restore(); }
  hits.marcas.push({ id: m.id, cx: x, cy: y, r: s / 2 + 5 });
}

/* ───────── Cuadros de texto con flecha ───────── */
const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
function nota(ctx, v, n, ui, hits) {
  const k = v.k, mm = merc(n.lat, n.lon), [x, y] = v.px(mm[0], mm[1]), size = n.tam * k, lineas = (n.mayus === false ? n.texto : n.texto.toUpperCase()).split('\n');
  ctx.save(); ctx.font = `800 ${size}px ${FUENTE}`; let ancho = 0; lineas.forEach(t => { ancho = Math.max(ancho, ctx.measureText(t).width); });
  const pad = size * 0.75, w = ancho + pad * 2, h = lineas.length * size * 1.15 + pad * 0.9;
  let ax = 0, ay = 0;
  if (n.ancla) {
    const am = merc(n.ancla.lat, n.ancla.lon); [ax, ay] = v.px(am[0], am[1]);
    ctx.lineCap = 'round'; ctx.strokeStyle = n.borde; ctx.lineWidth = Math.max(2, (n.bw || 3)) * k; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ax, ay); ctx.stroke();
  }
  rr(ctx, x - w / 2, y - h / 2, w, h, size * 0.6); sombra(ctx, k); ctx.fillStyle = n.fondo; ctx.fill(); sinSombra(ctx);
  ctx.lineWidth = (n.bw || 3) * k; ctx.strokeStyle = n.borde; ctx.stroke();
  ctx.fillStyle = n.color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  lineas.forEach((t, i) => ctx.fillText(t, x, y + (i - (lineas.length - 1) / 2) * size * 1.15));
  if (ui.ui && ui.sel && ui.sel.nota === n.id) {
    ctx.strokeStyle = '#1d5fb5'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]); ctx.strokeRect(x - w / 2 - 5, y - h / 2 - 5, w + 10, h + 10); ctx.setLineDash([]);
    if (n.ancla) { ctx.beginPath(); ctx.arc(ax, ay, 8, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
  hits.notas.push({ id: n.id, cx: x, cy: y, w, h, ax: n.ancla ? ax : null, ay: n.ancla ? ay : null });
}

/* ───────── Leyenda automática ───────── */
/* Todas las filas posibles de la leyenda (cada una con una clave para poder ocultarla) */
export function filasLeyenda(p) {
  const filas = [];
  for (const t of p.trazos) if (t.visible !== false && t.segs.length) filas.push({ key: 't:' + t.id, k: 'linea', t, txt: t.nombre });
  if (p.trazos.some(t => t.visible !== false && t.flechas && t.flechas.on)) { const t = p.trazos.find(q => q.visible !== false && q.flechas && q.flechas.on); filas.push({ key: 'flecha', k: 'flecha', t, txt: 'Sentido de la marcha' }); }
  [...new Set(p.marcas.map(m => m.tipo))].forEach(tp => filas.push({ key: 's:' + tp, k: 'senal', tp, txt: SENALES[tp] }));
  return filas;
}
function leyenda(ctx, v, p, area) {
  const L = p.leyenda; if (!L || !L.on) return;
  const k = v.k, size = L.tam * k, oc = L.ocultos || [], filas = filasLeyenda(p).filter(f => !oc.includes(f.key));
  if (!filas.length) return;
  ctx.save(); ctx.font = `700 ${size}px ${FUENTE}`; let ancho = 0; filas.forEach(f => { ancho = Math.max(ancho, ctx.measureText(f.txt).width); });
  const mu = size * 0.7, icono = size * 2.6, paso = size * 1.75, w = mu * 2 + icono + size * 0.7 + ancho, h = mu * 2 + paso * filas.length - size * 0.35, mg = 18 * k;
  const x0 = L.esq.includes('d') ? area.x + area.w - w - mg : area.x + mg, y0 = L.esq.includes('b') ? area.y + area.h - h - mg : area.y + mg;
  rr(ctx, x0, y0, w, h, size * 0.5); sombra(ctx, k); ctx.fillStyle = L.fondo; ctx.fill(); sinSombra(ctx); ctx.lineWidth = 2.5 * k; ctx.strokeStyle = L.borde; ctx.stroke();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  filas.forEach((f, i) => {
    const yy = y0 + mu + paso * i + paso * 0.4, xi = x0 + mu + icono / 2;
    if (f.k === 'linea') { ctx.lineCap = 'round'; ctx.setLineDash(f.t.discontinuo ? [size * 0.6, size * 0.45] : []); ctx.strokeStyle = f.t.color; ctx.lineWidth = Math.min(f.t.ancho, 12) * k; ctx.beginPath(); ctx.moveTo(x0 + mu + size * 0.2, yy); ctx.lineTo(x0 + mu + icono - size * 0.2, yy); ctx.stroke(); ctx.setLineDash([]); }
    else if (f.k === 'flecha') { ctx.fillStyle = f.t.flechas.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * k; flecha(ctx, xi, yy, 0, size * 1.1); }
    else dibujarSenal(ctx, f.tp, xi, yy, size * 1.45, k);
    ctx.fillStyle = L.color; ctx.font = `700 ${size}px ${FUENTE}`; ctx.fillText(f.txt, x0 + mu + icono + size * 0.7, yy);
  });
  ctx.restore();
}

/* ───────── Dibujo completo ───────── */
export function dibujar(ctx, v, p, ui = {}) {
  const hits = { labels: [], trazos: [], marcas: [], notas: [] }, cache = new Map(), area = ui.area || { x: 0, y: 0, w: v.w, h: v.h };
  ctx.save(); ctx.clearRect(0, 0, v.w, v.h);
  if (p.base === 'gris') { ctx.fillStyle = p.gris.fondo; ctx.fillRect(0, 0, v.w, v.h); calles(ctx, v, p); }
  for (const t of p.trazos) if (t.visible !== false) trazo(ctx, v, t, ui, hits, cache);
  for (const t of p.trazos) if (t.visible !== false) for (const l of t.etiquetas) if (l.visible !== false) etiqueta(ctx, v, t, l, ui, hits, cache);
  for (const m of p.marcas || []) marca(ctx, v, m, ui, hits);
  for (const n of p.notas || []) nota(ctx, v, n, ui, hits);
  leyenda(ctx, v, p, area);
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

/* Elemento bajo el puntero: cuadro de texto, señal o nombre (en ese orden, de arriba abajo) */
export function elementoEn(hits, x, y, sel = {}) {
  if (sel.nota) { const n = hits.notas.find(q => q.id === sel.nota); if (n && n.ax != null && Math.hypot(x - n.ax, y - n.ay) < 12) return { k: 'ancla', id: n.id }; }
  for (let i = hits.notas.length - 1; i >= 0; i--) { const n = hits.notas[i]; if (Math.abs(x - n.cx) <= n.w / 2 + 4 && Math.abs(y - n.cy) <= n.h / 2 + 4) return { k: 'nota', id: n.id }; }
  for (let i = hits.marcas.length - 1; i >= 0; i--) { const m = hits.marcas[i]; if (Math.hypot(x - m.cx, y - m.cy) <= m.r) return { k: 'marca', id: m.id }; }
  const l = etiquetaEn(hits, x, y); return l ? { k: 'label', id: l.id, tid: l.tid } : null;
}

/* Motor de dibujo: el MISMO código pinta la pantalla y la imagen que se descarga. */
import { net, merc, manzanas } from './net.js?v=20261108p';

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

/* Estilo «Beige»: fondo crema, manzanas en tono arena, calles blancas y vías principales amarillentas (fijo, sin teselas: también sale en la imagen descargada) */
export const TIERRA = { fondo: '#f4f0e6', manzana: '#e9dac0', borde: '#d8c6a2', via: '#ffffff', viaBorde: '#d8c6a2', verde: '#cfe4b3', verdeBorde: '#b4d391' };
function callesTierra(ctx, v, p) {
  if (!net.ready) return;
  const k = v.k, halo = Math.min(100 / v.mpp, 900), mg = halo / 2 / v.S;
  const vx0 = v.cx - v.w / 2 / v.S - mg, vx1 = v.cx + v.w / 2 / v.S + mg, vy0 = v.cy - v.h / 2 / v.S - mg, vy1 = v.cy + v.h / 2 / v.S + mg;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  const pasada = (clases, ancho, color) => {
    ctx.lineWidth = ancho; ctx.strokeStyle = color; ctx.beginPath(); let hay = false;
    for (const l of net.rl) {
      if (!clases.includes(l.m)) continue;
      const b = l.b; if (b[2] < vx0 || b[0] > vx1 || b[3] < vy0 || b[1] > vy1) continue;
      for (let i = 0; i < l.mx.length; i++) { const x = (l.mx[i] - v.cx) * v.S + v.w / 2, y = (l.my[i] - v.cy) * v.S + v.h / 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      hay = true;
    }
    if (hay) ctx.stroke();
  };
  const anc = (p.tierra && p.tierra.ancho) || 1, ancho = m => Math.min(70 * k, Math.max(1.3 * k, m * anc / v.mpp)), cas = 2.6 * k;
  if (halo > 4 * k) pasada([7.5, 10, 13], halo, TIERRA.manzana);       /* las zonas con calles se tiñen de arena: manzanas */
  { /* manzanas: cada espacio entre calles, de un color sólido (colegios y demás edificios incluidos) */
    ctx.fillStyle = TIERRA.manzana;
    const ox0 = v.cx - v.w / 2 / v.S, ox1 = v.cx + v.w / 2 / v.S, oy0 = v.cy - v.h / 2 / v.S, oy1 = v.cy + v.h / 2 / v.S;
    for (const a of manzanas()) {
      const b = a.b; if (b[2] < ox0 || b[0] > ox1 || b[3] < oy0 || b[1] > oy1) continue;
      ctx.beginPath(); for (let i = 0; i < a.mx.length; i++) { const x = (a.mx[i] - v.cx) * v.S + v.w / 2, y = (a.my[i] - v.cy) * v.S + v.h / 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill();
    }
  }
  if (net.verdes && net.verdes.length && !(p.tierra && p.tierra.verdes === false)) { /* zonas verdes (se pueden ocultar: entonces quedan como manzana) (parques, jardines, césped) */
    ctx.fillStyle = TIERRA.verde; ctx.strokeStyle = TIERRA.verdeBorde; ctx.lineWidth = 1.4 * k;
    const ox0 = v.cx - v.w / 2 / v.S, ox1 = v.cx + v.w / 2 / v.S, oy0 = v.cy - v.h / 2 / v.S, oy1 = v.cy + v.h / 2 / v.S;
    for (const a of net.verdes) {
      const b = a.b; if (b[2] < ox0 || b[0] > ox1 || b[3] < oy0 || b[1] > oy1) continue;
      ctx.beginPath(); for (let i = 0; i < a.mx.length; i++) { const x = (a.mx[i] - v.cx) * v.S + v.w / 2, y = (a.my[i] - v.cy) * v.S + v.h / 2; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
  }
  for (const m of [4.5, 7.5, 10, 13]) pasada([m], ancho(m) + cas, m >= 10 ? TIERRA.viaBorde : TIERRA.borde);
  for (const m of [4.5, 7.5, 10, 13]) pasada([m], ancho(m), m >= 10 ? TIERRA.via : '#ffffff');
}

/* ───────── Flechas de sentido ───────── */
function flecha(ctx, x, y, ang, s, doble = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
  const L = s * (doble ? 2.2 : 1.5), sw = s * 0.42, hw = s, hl = s * 0.8;
  if (doble) { /* flecha con punta en los dos extremos: calle de doble sentido */
    ctx.beginPath(); ctx.moveTo(-L / 2, 0); ctx.lineTo(-L / 2 + hl, -hw / 2); ctx.lineTo(-L / 2 + hl, -sw / 2); ctx.lineTo(L / 2 - hl, -sw / 2); ctx.lineTo(L / 2 - hl, -hw / 2); ctx.lineTo(L / 2, 0);
    ctx.lineTo(L / 2 - hl, hw / 2); ctx.lineTo(L / 2 - hl, sw / 2); ctx.lineTo(-L / 2 + hl, sw / 2); ctx.lineTo(-L / 2 + hl, hw / 2); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); return;
  }
  ctx.beginPath(); ctx.moveTo(-L / 2, -sw / 2); ctx.lineTo(L / 2 - hl, -sw / 2); ctx.lineTo(L / 2 - hl, -hw / 2); ctx.lineTo(L / 2, 0);
  ctx.lineTo(L / 2 - hl, hw / 2); ctx.lineTo(L / 2 - hl, sw / 2); ctx.lineTo(-L / 2, sw / 2); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore();
}
/* Zonas sin flechas (ancladas al mapa, en metros) convertidas a píxeles de esta vista */
const zonasPx = (v, f) => (f.sin || []).map(z => { const m = merc(z.lat, z.lon), q = v.px(m[0], m[1]); return { x: q[0], y: q[1], r: z.r / v.mpp }; });
function flechas(ctx, v, t, segs, evitar = []) {
  const f = t.flechas, k = v.k, size = f.tam * k, sep = f.sep * k; if (sep < 8 || size < 2) return;
  const L = size * (f.doble ? 2.2 : 1.5), zonas = zonasPx(v, f);
  ctx.fillStyle = f.color; ctx.strokeStyle = f.borde || '#ffffff'; ctx.lineWidth = 2 * k; ctx.lineJoin = 'round'; ctx.setLineDash([]);
  for (const s of segs) {
    const cum = [0]; for (let i = 1; i < s.length; i++) cum.push(cum[i - 1] + Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]));
    const total = cum[cum.length - 1];
    const pos = d => { let j = 1; while (j < cum.length - 1 && cum[j] < d) j++; const a = s[j - 1], b = s[j], u = (d - cum[j - 1]) / (cum[j] - cum[j - 1] || 1); return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, Math.atan2(b[1] - a[1], b[0] - a[0])]; };
    /* La flecha solo se pone donde el trazo es casi recto en toda su longitud: así no aparecen en glorietas ni curvas cerradas, a cualquier zoom */
    const recta = d => { const p0 = pos(Math.max(0, d - L / 2)), p1 = pos(d), p2 = pos(Math.min(total, d + L / 2)), ax = p1[0] - p0[0], ay = p1[1] - p0[1], bx = p2[0] - p1[0], by = p2[1] - p1[1], la = Math.hypot(ax, ay), lb = Math.hypot(bx, by); if (la < 1e-6 || lb < 1e-6) return true; return Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)))) < 0.45; };
    let nominal = sep / 2, ultimo = -1e9;
    while (nominal < total) {
      for (const o of [0, 0.12, -0.12, 0.24, -0.24, 0.36, -0.36]) {
        const d = nominal + o * sep; if (d <= 0 || d >= total || d - ultimo < sep * 0.6 || !recta(d) || !recta(Math.max(L / 2, d - L * 0.6)) || !recta(Math.min(total - L / 2, d + L * 0.6))) continue;
        const [ax, ay, ang] = pos(d);
        if (zonas.some(z => Math.hypot(z.x - ax, z.y - ay) < z.r) || evitar.some(e => Math.hypot(e.x - ax, e.y - ay) < e.r + size * 0.6)) continue;
        flecha(ctx, ax, ay, ang, size, !!f.doble); ultimo = d; break;
      }
      nominal += sep;
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
  if (ui.ui && ui.sel && ui.sel.trazo === t.id && t.flechas) for (const z of zonasPx(v, t.flechas)) { ctx.save(); ctx.beginPath(); ctx.arc(z.x, z.y, z.r, 0, 7); ctx.fillStyle = 'rgba(217,45,32,.10)'; ctx.fill(); ctx.setLineDash([6, 5]); ctx.lineWidth = 1.5; ctx.strokeStyle = '#d92d20'; ctx.stroke(); ctx.restore(); }
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
export const TRAFICO = { prohibido: 'Dirección prohibida', obras: 'Obras', peligro: 'Peligro', estacionar: 'Prohibido estacionar', salida: 'Salida / llegada', meta: 'Meta', obligatorio: 'Dirección obligatoria', minusvalido: 'Plaza movilidad reducida' };
/* Puntos de referencia (dibujos): no salen en la leyenda */
export const REFERENCIAS = { iglesia: 'Iglesia', edificio: 'Edificio', fuente: 'Fuente', futbol: 'Campo de fútbol', arco: 'Arco (sin texto)', arcosalida: 'Arco de salida', arcometa: 'Arco de meta', aparcamiento: 'Aparcamiento', parque: 'Parque / árbol' };
/* Objetos para cortes de calle (dibujos): agente, coche patrulla, valla, cono, raya y cinta; no salen en la leyenda */
export const CORTES = { agente: 'Agente de Policía Local', patrulla: 'Coche patrulla', valla: 'Valla', cono: 'Cono', raya: 'Raya de corte', cinta: 'Cinta rojiblanca' };
export const SENALES = { ...TRAFICO, ...REFERENCIAS, ...CORTES };
const poli = (ctx, pts, fill, borde) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (borde) { ctx.strokeStyle = borde; ctx.stroke(); } };
const rect = (ctx, x, y, w, h, fill, borde) => poli(ctx, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, borde);
const disco = (ctx, x, y, r, fill, borde) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (borde) { ctx.strokeStyle = borde; ctx.stroke(); } };
function rayas(ctx, x, y, w, h, paso, c1, c2) {
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); rect(ctx, x, y, w, h, c1);
  for (let i = -h; i < w + h; i += paso * 2) poli(ctx, [[x + i, y + h], [x + i + paso, y + h], [x + i + paso + h, y], [x + i + h, y]], c2);
  ctx.restore();
}
function dibujarCorte(ctx, tipo, s) {
  const u = s / 100, O = 'rgba(16,24,40,.5)'; ctx.scale(u, u); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (tipo === 'agente') {
    /* Agente de tráfico de frente: gorra de plato con banda de cuadros, chaleco reflectante, guantes blancos y brazo extendido (señal de alto) */
    const AZ = '#1b3a6b', PANT = '#122a52', PIEL = '#f0c6a0', VEST = '#d4e03a', trazo = (x1, y1, x2, y2, w, c) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = w; ctx.strokeStyle = c; ctx.stroke(); };
    const elipse = (x, y, rx, ry, c, borde) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fillStyle = c; ctx.fill(); if (borde) { ctx.lineWidth = 1.6; ctx.strokeStyle = borde; ctx.stroke(); } };
    ctx.translate(0, 2);
    trazo(-6.5, 10, -8, 40, 12, PANT); trazo(6.5, 10, 8, 40, 12, PANT); elipse(-9.5, 44, 9, 4.2, '#0b1220'); elipse(9.5, 44, 9, 4.2, '#0b1220');   /* piernas y zapatos */
    trazo(-17, -19, -23, 3, 9.5, AZ); elipse(-23.5, 7.5, 4.6, 5, '#ffffff', O);                                                                     /* brazo caído con guante */
    trazo(16, -19, 41, -23, 9.5, AZ); elipse(46, -24, 5, 6.5, '#ffffff', O); trazo(41.5, -29, 41.5, -18, 0.01, AZ);                                /* brazo extendido con la palma abierta */
    poli(ctx, [[-17, -25], [17, -25], [20, 12], [-20, 12]], AZ, O);                                                                                  /* torso */
    poli(ctx, [[-15, -25], [-5, -25], [0, -17], [5, -25], [15, -25], [18, 12], [-18, 12]], VEST, O);                                                   /* chaleco */
    rect(ctx, -17.2, -8, 34.4, 4, '#eef2f7'); rect(ctx, -18, 1, 36, 4, '#eef2f7'); rect(ctx, -20, 10, 40, 5.5, '#0b1220'); rect(ctx, -2.5, 10.8, 5, 4, '#e0b43a');   /* bandas reflectantes y cinturón */
    rect(ctx, -3.2, -30, 6.4, 7, PIEL); elipse(-8.6, -36, 2, 3, PIEL, O); elipse(8.6, -36, 2, 3, PIEL, O); elipse(0, -36.5, 8.6, 9.6, PIEL, O);        /* cuello, orejas y cabeza */
    disco(ctx, -3.3, -36, 1.1, '#1f2937'); disco(ctx, 3.3, -36, 1.1, '#1f2937');
    rect(ctx, -10.5, -48, 21, 8, AZ, O); elipse(0, -48, 11.5, 3.6, '#2b4f8f', O); for (let i = 0; i < 6; i++) rect(ctx, -10.5 + i * 3.5, -43, 3.5, 3.2, i % 2 ? '#ffffff' : '#1d5fb5');   /* gorra de plato con banda de cuadros */
    poli(ctx, [[-10.5, -40], [10.5, -40], [12.5, -37.2], [-12.5, -37.2]], '#0b1220'); disco(ctx, 0, -46, 1.8, '#e0b43a');
  } else if (tipo === 'patrulla') {
    ctx.translate(0, 2);
    poli(ctx, [[-28, 2], [-15, -18], [19, -18], [32, 2]], '#ffffff', O); poli(ctx, [[-22, 0], [-13, -14], [-1, -14], [-1, 0]], '#9fc9e8'); poli(ctx, [[2, 0], [2, -14], [17, -14], [26, 0]], '#9fc9e8');
    rect(ctx, -9, -23, 9, 5, '#1d5fb5', O); rect(ctx, 0, -23, 9, 5, '#d92d20', O);
    rr(ctx, -48, 0, 96, 26, 8); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = O; ctx.stroke(); rect(ctx, -46, 9, 92, 6, '#1d5fb5'); rect(ctx, -46, 15, 92, 2.5, '#f5d90a');
    for (const x of [-28, 28]) { disco(ctx, x, 27, 10, '#111827'); disco(ctx, x, 27, 4.5, '#9ca3af'); }
  } else if (tipo === 'valla') {
    ctx.translate(0, 2); rect(ctx, -46, 36, 24, 5, '#44505e'); rect(ctx, 22, 36, 24, 5, '#44505e');
    rayas(ctx, -38, -14, 76, 28, 9, '#ffffff', '#d92d20'); ctx.strokeStyle = '#44505e'; ctx.lineWidth = 4; ctx.strokeRect(-38, -14, 76, 28);
    ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-38, -34); ctx.lineTo(-38, 38); ctx.moveTo(38, -34); ctx.lineTo(38, 38); ctx.moveTo(-38, -30); ctx.lineTo(38, -30); ctx.moveTo(-38, 22); ctx.lineTo(38, 22); ctx.stroke();
  } else if (tipo === 'cono') {
    ctx.translate(0, 2); rect(ctx, -30, 34, 60, 9, '#374151', O); poli(ctx, [[-5, -44], [5, -44], [23, 34], [-23, 34]], '#f97316', O);
    const hw = y => 5 + (y + 44) / 78 * 18; for (const [a, b] of [[-18, -6], [8, 22]]) poli(ctx, [[-hw(a), a], [hw(a), a], [hw(b), b], [-hw(b), b]], '#ffffff');
  } else if (tipo === 'raya') {
    rr(ctx, -50, -7, 100, 14, 7); ctx.fillStyle = '#d92d20'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  } else if (tipo === 'cinta') {
    ctx.save(); rr(ctx, -50, -7, 100, 14, 7); ctx.clip(); rayas(ctx, -50, -7, 100, 14, 8, '#ffffff', '#d92d20'); ctx.restore(); rr(ctx, -50, -7, 100, 14, 7); ctx.lineWidth = 2.4; ctx.strokeStyle = O; ctx.stroke();
  }
}
function dibujarRef(ctx, tipo, s) {
  const u = s / 100, O = 'rgba(16,24,40,.5)', SUELO = '#9a8f86'; ctx.scale(u, u); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (tipo === 'iglesia') {
    ctx.translate(0, 9); ctx.scale(0.95, 0.95);
    for (const sx of [-1, 1]) { const x = sx * 26; rect(ctx, x - 9, -2, 18, 40, '#e6bfa8', O); poli(ctx, [[x - 11, -2], [x, -28], [x + 11, -2]], '#5b6b8c', O); rect(ctx, x - 3, 8, 6, 10, '#7fa6c9', O); }
    rect(ctx, -15, -18, 30, 56, '#eccbb6', O); poli(ctx, [[-17, -18], [0, -52], [17, -18]], '#5b6b8c', O);
    ctx.beginPath(); ctx.moveTo(0, -52); ctx.lineTo(0, -63); ctx.moveTo(-4.5, -58); ctx.lineTo(4.5, -58); ctx.strokeStyle = '#3b3f4a'; ctx.lineWidth = 2.6; ctx.stroke(); ctx.lineWidth = 2;
    disco(ctx, 0, -6, 7.5, '#f6f1e7', O);
    ctx.beginPath(); ctx.moveTo(-7, 38); ctx.lineTo(-7, 25); ctx.arc(0, 25, 7, Math.PI, 0); ctx.lineTo(7, 38); ctx.closePath(); ctx.fillStyle = '#7a4b3a'; ctx.fill(); ctx.strokeStyle = O; ctx.stroke();
    rect(ctx, -44, 38, 88, 4, SUELO);
  } else if (tipo === 'edificio') {
    ctx.translate(0, 4); rect(ctx, -32, -34, 64, 72, '#ead9c0', O); rect(ctx, -37, -43, 74, 10, '#9b6b53', O);
    for (let f = 0; f < 3; f++) for (let c = 0; c < 3; c++) { if (f === 2 && c === 1) continue; rect(ctx, -24 + c * 18, -24 + f * 18, 12, 12, '#7fb0d6', '#46749a'); }
    rect(ctx, -6, 22, 12, 16, '#6b4a3a', O); rect(ctx, -40, 38, 80, 4, SUELO);
  } else if (tipo === 'fuente') {
    ctx.translate(0, 4);
    rect(ctx, -5, -4, 10, 26, '#b9c4cc', O);
    ctx.beginPath(); ctx.ellipse(0, 24, 38, 14, 0, 0, 7); ctx.fillStyle = '#b9c4cc'; ctx.fill(); ctx.strokeStyle = O; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 24, 31, 9, 0, 0, 7); ctx.fillStyle = '#6ec1ea'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -4, 19, 6, 0, 0, 7); ctx.fillStyle = '#cfd8de'; ctx.fill(); ctx.strokeStyle = O; ctx.stroke();
    ctx.strokeStyle = '#3fa7e0'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(0, -40); ctx.moveTo(-2, -6); ctx.quadraticCurveTo(-26, -48, -28, 14); ctx.moveTo(2, -6); ctx.quadraticCurveTo(26, -48, 28, 14); ctx.stroke();
    disco(ctx, -14, -38, 2.5, '#6ec1ea'); disco(ctx, 14, -38, 2.5, '#6ec1ea'); disco(ctx, 0, -46, 3, '#6ec1ea');
  } else if (tipo === 'futbol') {
    for (let i = 0; i < 6; i++) rect(ctx, -44 + i * 14.667, -30, 14.667, 60, i % 2 ? '#4cae58' : '#3f9d4a');
    ctx.strokeStyle = O; ctx.lineWidth = 2; ctx.strokeRect(-44, -30, 88, 60);
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.4; ctx.strokeRect(-40, -26, 80, 52); ctx.strokeRect(-40, -13, 14, 26); ctx.strokeRect(26, -13, 14, 26);
    ctx.beginPath(); ctx.moveTo(0, -26); ctx.lineTo(0, 26); ctx.stroke(); disco(ctx, 0, 0, 9, null, '#ffffff');
  } else if (tipo === 'arco' || tipo === 'arcosalida' || tipo === 'arcometa') {
    const meta = tipo === 'arcometa', liso = tipo === 'arco', col = meta ? '#101828' : '#16a34a';
    ctx.translate(0, -5);
    rect(ctx, -44, -4, 12, 44, '#e5e7eb', O); rect(ctx, 32, -4, 12, 44, '#e5e7eb', O); rect(ctx, -44, 22, 12, 6, col); rect(ctx, 32, 22, 12, 6, col);
    rect(ctx, -48, -36, 96, 32, col, O);
    if (meta) for (let i = 0; i < 12; i++) { rect(ctx, -48 + i * 8, -36, 8, 5, i % 2 ? '#ffffff' : '#101828'); rect(ctx, -48 + i * 8, -9, 8, 5, i % 2 ? '#101828' : '#ffffff'); }
    if (liso) { rect(ctx, -48, -22, 96, 5, '#ffffff'); }
    else { ctx.fillStyle = '#ffffff'; ctx.font = `800 19px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(meta ? 'META' : 'SALIDA', 0, -20); }
    rect(ctx, -50, 40, 100, 4, SUELO);
  } else if (tipo === 'aparcamiento') {
    rr(ctx, -38, -38, 76, 76, 12); ctx.fillStyle = '#1d5fb5'; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.font = `800 60px ${FUENTE}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('P', 0, 4);
  } else if (tipo === 'parque') {
    ctx.translate(0, 4); rect(ctx, -5, 8, 10, 32, '#8a5a3c', O);
    disco(ctx, -18, 0, 19, '#3f9d4a', O); disco(ctx, 18, 0, 19, '#3f9d4a', O); disco(ctx, 0, -18, 25, '#4cae58', O); disco(ctx, -8, -24, 8, '#66c274');
    rect(ctx, -26, 40, 52, 4, SUELO);
  }
}
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
  } else if (tipo === 'obligatorio') {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); sombra(ctx, k); ctx.fillStyle = '#1d5fb5'; ctx.fill(); sinSombra(ctx);
    ctx.lineWidth = s * 0.05; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.beginPath(); [[-0.07, 0.3], [0.07, 0.3], [0.07, 0.02], [0.2, 0.02], [0, -0.3], [-0.2, 0.02], [-0.07, 0.02]].forEach((q, i) => (i ? ctx.lineTo(q[0] * s, q[1] * s) : ctx.moveTo(q[0] * s, q[1] * s))); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
  } else if (tipo === 'minusvalido') {
    const u = s / 100; rr(ctx, -r, -r, s, s, s * 0.12); sombra(ctx, k); ctx.fillStyle = '#1d5fb5'; ctx.fill(); sinSombra(ctx); ctx.lineWidth = s * 0.045; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.save(); ctx.scale(u, u); ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(-6, -27, 6.5, 0, 7); ctx.fill();
    ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(-6, -15); ctx.lineTo(-6, 4); ctx.lineTo(14, 4); ctx.lineTo(23, 24); ctx.stroke();
    ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-6, -9); ctx.lineTo(12, -9); ctx.stroke();
    ctx.lineWidth = 6.5; ctx.beginPath(); ctx.arc(-8, 13, 19, 0.15 * Math.PI, 1.55 * Math.PI); ctx.stroke(); ctx.restore();
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
  } else if (REFERENCIAS[tipo]) {
    dibujarRef(ctx, tipo, s);
  } else if (CORTES[tipo]) {
    dibujarCorte(ctx, tipo, s);
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
  if (p.trazos.some(t => t.visible !== false && t.flechas && t.flechas.on)) { const t = p.trazos.find(q => q.visible !== false && q.flechas && q.flechas.on); filas.push({ key: 'flecha', k: 'flecha', t, txt: t.flechas.doble ? 'Doble sentido' : 'Sentido de la marcha' }); }
  [...new Set(p.marcas.map(m => m.tipo))].filter(tp => !REFERENCIAS[tp] && !CORTES[tp]).forEach(tp => filas.push({ key: 's:' + tp, k: 'senal', tp, txt: SENALES[tp] }));
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
    else if (f.k === 'flecha') { ctx.fillStyle = f.t.flechas.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5 * k; flecha(ctx, xi, yy, 0, size * 1.1, !!f.t.flechas.doble); }
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
  else if (p.base === 'tierra') { ctx.fillStyle = TIERRA.fondo; ctx.fillRect(0, 0, v.w, v.h); callesTierra(ctx, v, p); }
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

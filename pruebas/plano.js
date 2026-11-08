const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const C = require('./common'); const SC = __dirname;
const ROOT = path.resolve(__dirname, '..');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { const t = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png' }[p.split('.').pop()] || 'application/octet-stream'; r.writeHead(200, { 'Content-Type': t }); r.end(d); } }); }).listen(8900);
const out = (...a) => console.log(...a); const errs = [];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true, deviceScaleFactor: 1 }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && errs.push('console: ' + m.text())); await C.mockNet(page);
  await page.goto('http://localhost:8900/index.html'); await page.waitForFunction(() => window.__plano && window.__plano.net.ready);
  out('1. arranca; callejero cargado:', await page.evaluate(() => window.__plano.net.ready), '| pestañas:', (await page.$$eval('#tabs button', b => b.map(x => x.textContent))).join(' | '));
  await page.evaluate(([a, c]) => window.__plano.map.setView([a, c], 16.5), C.ll(2, 2)); await page.waitForTimeout(300);
  const click = async (i, j, off = [0, 0]) => { const [x, y] = await page.evaluate(([la, lo]) => { const m = window.__plano.map, p = m.latLngToContainerPoint([la, lo]), r = m.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }, C.ll(i, j)); await page.mouse.click(x + off[0], y + off[1]); await page.waitForTimeout(150); };
  // 2. recorrido: sale de (1,0) por la calle 2 hasta (1,4), baja por la columna 5 hasta (3,4) y vuelve por la calle 4 hasta (3,0)
  await page.click('[data-act=nuevo]'); await click(1, 0, [10, 4]); await click(1, 4, [-10, 4]); await click(3, 4, [-4, -10]); await click(3, 0, [10, 4]);
  await page.screenshot({ path: SC + '/100-dibujando.png' });
  await page.click('[data-act=terminar]'); await page.waitForTimeout(300);
  const t = await page.evaluate(() => { const p = window.__plano.S.p; const t = p.trazos[0]; return { n: p.trazos.length, segs: t.segs.length, pts: t.segs[0].length, etiquetas: t.etiquetas.map(l => l.texto) }; });
  out('2. trazo creado:', JSON.stringify(t));
  await page.screenshot({ path: SC + '/101-trazo.png' });
  // 3. personalizar: color, nombre del trazo, texto y giro de una etiqueta
  await page.click('.sw[data-v="#d92d20"]'); await page.waitForTimeout(150);
  console.log('3. color del trazo:', await page.evaluate(() => window.__plano.S.p.trazos[0].color));
  await page.click('[data-act=tab][data-t=nombres]'); await page.waitForSelector('.fila .txt');
  await page.fill('.fila .txt >> nth=0', 'C/ Mayor (centro)'); await page.click('[data-act=sell] >> nth=0'); await page.waitForSelector('[data-k=giro]');
  await page.fill('[data-k=giro]', '-12'); await page.dispatchEvent('[data-k=giro]', 'input'); await page.waitForTimeout(200);
  out('   etiqueta editada:', await page.evaluate(() => { const l = window.__plano.S.p.trazos[0].etiquetas[0]; return `${l.texto} | giro ${l.giro} | tam ${l.tam} | ${l.color}`; }));
  // 4. arrastrar un nombre
  const pos0 = await page.evaluate(() => { const l = window.__plano.S.p.trazos[0].etiquetas[0]; return [l.lat, l.lon]; });
  const h = await page.evaluate(() => window.__plano.hits().labels[0]); const r = await page.evaluate(() => { const b = document.querySelector('#map').getBoundingClientRect(); return [b.left, b.top]; });
  await page.mouse.move(r[0] + h.cx, r[1] + h.cy); await page.mouse.down(); await page.mouse.move(r[0] + h.cx + 60, r[1] + h.cy - 40, { steps: 6 }); await page.mouse.up(); await page.waitForTimeout(250);
  const pos1 = await page.evaluate(() => { const l = window.__plano.S.p.trazos[0].etiquetas[0]; return [l.lat, l.lon]; });
  out('4. nombre arrastrado: movió =', JSON.stringify(pos0) !== JSON.stringify(pos1), '| el mapa NO se desplazó con él:', await page.evaluate(([a, c]) => { const m = window.__plano.map.getCenter(); return Math.abs(m.lat - a) < 1e-6 && Math.abs(m.lng - c) < 1e-6; }, C.ll(2, 2)));
  await page.screenshot({ path: SC + '/102-personalizado.png' });
  // 5. exportar
  await page.click('[data-act=tab][data-t=exportar]'); await page.waitForSelector('#marco:not([hidden])'); await page.waitForTimeout(300); await page.screenshot({ path: SC + '/103-exportar.png' });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=png]')]); const file = SC + '/export.png'; await dl.saveAs(file);
  out('5. descarga:', dl.suggestedFilename());
  // 6. persistencia
  await page.reload(); await page.waitForFunction(() => window.__plano && window.__plano.net.ready); out('6. tras recargar, trazos guardados:', await page.evaluate(() => window.__plano.S.p.trazos.length), '| etiquetas:', await page.evaluate(() => window.__plano.S.p.trazos[0].etiquetas.length));
  out('ERRORES:', errs); await b.close(); srv.close();
})().catch(e => { console.error('FALLO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });

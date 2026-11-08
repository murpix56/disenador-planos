/* Lista «Mis planos»: guardar, actualizar sola, duplicar, abrir (con la vista del mapa), borrar, y capturas de la interfaz */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const C = require('./common'); const SC = __dirname;
const ROOT = path.resolve(__dirname, '..');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { const t = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png' }[p.split('.').pop()] || 'application/octet-stream'; r.writeHead(200, { 'Content-Type': t }); r.end(d); } }); }).listen(8911);
const out = (...a) => console.log(...a); const errs = [];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 860 } }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && errs.push('console: ' + m.text())); await C.mockNet(page);
  page.on('dialog', d => d.accept());
  await page.goto('http://localhost:8911/index.html'); await page.waitForFunction(() => window.__plano && window.__plano.net.ready);
  await page.evaluate(([a, c]) => window.__plano.map.setView([a, c], 16.5), C.ll(2, 2)); await page.waitForTimeout(300);
  const clickLL = async (la, lo) => { const [x, y] = await page.evaluate(([la, lo]) => { const m = window.__plano.map, p = m.latLngToContainerPoint([la, lo]), r = m.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }, [la, lo]); await page.mouse.click(x, y); await page.waitForTimeout(150); };
  await page.click('[data-act=nuevo]'); await clickLL(...C.ll(1, 0)); await clickLL(...C.ll(1, 4)); await page.click('[data-act=terminar]'); await page.waitForTimeout(300);
  for (const t of ['plano', 'trazos', 'nombres', 'senales']) { await page.click(`[data-act=tab][data-t=${t}]`); if (t === 'senales') await page.check('[data-o=le][data-k=on]'); await page.waitForTimeout(150); await page.screenshot({ path: `${SC}/120-${t}.png` }); }
  await page.fill('#nombre', 'Corte Navidad'); await page.waitForTimeout(500);
  await page.click('[data-act=tab][data-t=exportar]');
  await page.click('[data-act=bib-guardar]'); await page.waitForTimeout(300);
  const bib = () => page.evaluate(() => JSON.parse(localStorage.getItem('plano.biblioteca.v1') || '[]').map(e => `${e.nombre}:${e.p.trazos.length}:${e.p.trazos[0] && e.p.trazos[0].nombre}`));
  out('1. guardado:', JSON.stringify(await bib()));
  await page.click('[data-act=tab][data-t=trazos]'); await page.fill('[data-o=t][data-k=nombre]', 'Itinerario cambiado'); await page.waitForTimeout(700);
  out('2. actualizado solo:', JSON.stringify(await bib()));
  await page.click('[data-act=tab][data-t=exportar]'); await page.click('[data-act=bib-dup]'); await page.waitForTimeout(200);
  out('3. duplicado:', JSON.stringify(await bib()));
  await page.screenshot({ path: `${SC}/123-exportar.png` });
  await page.click('[data-act=nuevo-proy]'); await page.click('[data-act=nuevo-proy]'); await page.evaluate(() => window.__plano.map.setView([40, -5], 12, { animate: false })); await page.waitForTimeout(700);
  out('4. plano nuevo, trazos:', await page.evaluate(() => window.__plano.S.p.trazos.length));
  await page.click('[data-act=tab][data-t=exportar]'); await page.click('.fila[data-act=bib-abrir] >> nth=0'); await page.waitForTimeout(500);
  out('5. abierto:', await page.evaluate(() => ({ trazos: window.__plano.S.p.trazos.length, nombre: window.__plano.S.p.nombre, zoom: window.__plano.map.getZoom() })));
  await page.click('[data-act=tab][data-t=exportar]'); await page.click('[data-act=bib-borrar] >> nth=0'); await page.click('[data-act=bib-borrar] >> nth=0'); await page.waitForTimeout(200);
  out('6. borrado, quedan:', (await bib()).length);
  await page.reload(); await page.waitForFunction(() => window.__plano && window.__plano.net.ready);
  out('7. tras recargar, trazos:', await page.evaluate(() => window.__plano.S.p.trazos.length));
  out('ERRORES:', JSON.stringify(errs)); await b.close(); srv.close();
})();

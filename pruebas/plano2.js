const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const C = require('./common'); const SC = __dirname;
const ROOT = path.resolve(__dirname, '..');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { const t = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png' }[p.split('.').pop()] || 'application/octet-stream'; r.writeHead(200, { 'Content-Type': t }); r.end(d); } }); }).listen(8910);
const out = (...a) => console.log(...a); const errs = [];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 860 }, acceptDownloads: true }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && errs.push('console: ' + m.text())); await C.mockNet(page);
  await page.goto('http://localhost:8910/index.html'); await page.waitForFunction(() => window.__plano && window.__plano.net.ready);
  await page.evaluate(([a, c]) => window.__plano.map.setView([a, c], 16.5), C.ll(2, 2)); await page.waitForTimeout(300);
  const clickLL = async (la, lo, off = [0, 0]) => { const [x, y] = await page.evaluate(([la, lo]) => { const m = window.__plano.map, p = m.latLngToContainerPoint([la, lo]), r = m.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }, [la, lo]); await page.mouse.click(x + off[0], y + off[1]); await page.waitForTimeout(150); };
  const click = (i, j, off) => clickLL(...C.ll(i, j), off);
  const est = () => page.evaluate(() => { const p = window.__plano.S.p; return { trazos: p.trazos.map(t => `${t.nombre}:${t.color}`), marcas: p.marcas.map(m => m.tipo), notas: p.notas.length }; });
  // 1. Itinerario (estilo por defecto) → salida y meta automáticas
  await page.click('[data-act=nuevo]'); await click(1, 0); await click(1, 4); await click(3, 4); await page.click('[data-act=terminar]'); await page.waitForTimeout(300);
  out('1. Itinerario:', JSON.stringify(await est()));
  // 2. Corte: dos señales de dirección prohibida
  await page.click('[data-act=tab][data-t=trazos]'); await page.click('[data-act=nuevo]'); await page.click('[data-act=preset-nuevo][data-p=corte]'); await click(2, 1); await click(2, 3); await page.click('[data-act=terminar]'); await page.waitForTimeout(300);
  out('2. Corte:', JSON.stringify(await est()));
  // 3. Señal a mano (obras) con texto, y cuadro de texto con flecha
  await page.click('[data-act=tab][data-t=senales]'); await page.waitForSelector('.pal .pb'); await page.screenshot({ path: SC + '/110-senales.png', clip: { x: 0, y: 160, width: 380, height: 700 } });
  await page.click('.pb[data-tipo=obras]'); await clickLL(...C.ll(2.5, 2)); await page.waitForSelector('[data-k=texto]'); await page.fill('[data-o=ma][data-k=texto]', 'C/ Santa Marta');
  await page.click('[data-act=poner-nota]'); await clickLL(...C.ll(0.6, 3)); await page.waitForSelector('textarea'); await page.fill('textarea', 'ZONA DE SALIDA\nY LLEGADA'); await page.dispatchEvent('textarea', 'input'); await page.click('[data-act=nota-ancla]'); await page.waitForTimeout(200);
  out('3. Señales y cuadro:', JSON.stringify(await est()), '| flecha del cuadro:', await page.evaluate(() => !!window.__plano.S.p.notas[0].ancla));
  // 4. Leyenda
  await page.check('[data-o=le][data-k=on]'); await page.waitForTimeout(200);
  // 5. Deshacer / rehacer
  await page.waitForTimeout(500); const antes = (await est()).marcas.length;
  await page.click('[data-act=tab][data-t=senales]'); await page.click('.fila[data-k=marca] >> nth=0'); await page.click('[data-act=quitar-sel]'); await page.waitForTimeout(450); const quitada = (await est()).marcas.length;
  await page.click('#btnUndo'); await page.waitForTimeout(300); const deshecha = (await est()).marcas.length;
  await page.click('#btnRedo'); await page.waitForTimeout(300); const rehecha = (await est()).marcas.length;
  out('5. señales: antes', antes, '→ quitar', quitada, '→ deshacer', deshecha, '→ rehacer', rehecha);
  // 6. Exportar: encuadrar y descargar
  await page.click('[data-act=tab][data-t=exportar]'); await page.waitForSelector('#marco:not([hidden])'); const z0 = await page.evaluate(() => window.__plano.map.getZoom());
  await page.click('[data-act=encuadrar]'); await page.waitForTimeout(500); const z1 = await page.evaluate(() => window.__plano.map.getZoom());
  out('6. encuadrar: zoom', z0, '→', z1); await page.screenshot({ path: SC + '/111-todo.png' });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=png]')]); await dl.saveAs(SC + '/export2.png');
  out('ERRORES:', errs); await b.close(); srv.close();
})().catch(e => { console.error('FALLO', e.message.split('\n').slice(0, 6).join('\n')); process.exit(1); });

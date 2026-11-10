/* Proporción con el zoom: los tamaños se escalan con el zoom, lo nuevo se ve con su tamaño normal y se puede fijar otra referencia sin cambiar lo que se ve */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const C = require('./common'); const SC = __dirname;
const ROOT = path.resolve(__dirname, '..');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { const t = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png' }[p.split('.').pop()] || 'application/octet-stream'; r.writeHead(200, { 'Content-Type': t }); r.end(d); } }); }).listen(8913);
const out = (...a) => console.log(...a); const errs = [];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 860 } }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && errs.push('console: ' + m.text())); await C.mockNet(page);
  await page.goto('http://localhost:8913/index.html'); await page.waitForFunction(() => window.__plano && window.__plano.net.ready);
  const zoom = async z => { await page.evaluate(z => window.__plano.map.setZoom(z), z); await page.waitForTimeout(250); };
  const clickLL = async (la, lo) => { const [x, y] = await page.evaluate(([la, lo]) => { const m = window.__plano.map, p = m.latLngToContainerPoint([la, lo]), r = m.getContainer().getBoundingClientRect(); return [r.left + p.x, r.top + p.y]; }, [la, lo]); await page.mouse.click(x, y); await page.waitForTimeout(150); };
  const medidas = () => page.evaluate(() => { const P = window.__plano, h = P.hits(); P.pintar(); const t = P.hits(); return { ancho: Math.round(t.trazos[0].w * 10) / 10, etiqueta: Math.round(t.labels[0].h * 10) / 10, marcas: t.marcas.map(m => Math.round(m.r * 10) / 10) }; });
  await page.evaluate(([a, c]) => window.__plano.map.setView([a, c], 17), C.ll(2, 2)); await page.waitForTimeout(300);
  await page.click('[data-act=nuevo]'); await clickLL(...C.ll(1, 0)); await clickLL(...C.ll(1, 4)); await page.click('[data-act=terminar]'); await page.waitForTimeout(400);
  await page.evaluate(() => { window.__plano.S.p.trazos[0].ancho = 20; });
  const m17 = await medidas(); out('1. zoom 17 (referencia):', JSON.stringify(m17), '| zref:', await page.evaluate(() => window.__plano.S.p.escala.zref));
  await zoom(16); const m16 = await medidas(); out('2. zoom 16 (mitad):', JSON.stringify(m16), '| grosor a la mitad:', Math.abs(m16.ancho - m17.ancho / 2) < 1);
  await page.click('[data-act=tab][data-t=senales]'); await page.selectOption('select[data-cat]', 'cortes'); await page.click('.pb[data-tipo=cono]'); await clickLL(...C.ll(2, 2));
  const tam = await page.evaluate(() => window.__plano.S.p.marcas.map(m => m.tam)); const m16b = await medidas();
  out('3. señal nueva a zoom 16: tam guardado', JSON.stringify(tam), '| radio visible', JSON.stringify(m16b.marcas), '(normal ~ 27 px)');
  await page.click('[data-act=tab][data-t=plano]'); await page.click('[data-act=esc-ref]'); await page.waitForTimeout(300); const m16c = await medidas();
  out('4. tras fijar referencia en 16, se ve igual:', JSON.stringify(m16b) === JSON.stringify(m16c), JSON.stringify(m16c), '| zref', await page.evaluate(() => window.__plano.S.p.escala.zref));
  await page.uncheck('[data-o=es][data-k=on]'); await zoom(17); const off17 = await medidas(); out('5. desactivado, zoom 17:', JSON.stringify(off17));
  await page.screenshot({ path: SC + '/140-proporcion.png' });
  out('ERRORES:', JSON.stringify(errs)); await b.close(); srv.close();
})();

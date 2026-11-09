/* Cambio de localidad: busca (Nominatim simulado), descarga el callejero (Overpass simulado), centra el mapa, se recuerda al recargar y se puede volver a Don Benito */
const { chromium } = require('playwright'); const http = require('http'), fs = require('fs'), path = require('path'); const C = require('./common'); const SC = __dirname;
const ROOT = path.resolve(__dirname, '..');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p === '/') p = '/index.html'; fs.readFile(path.join(ROOT, p), (e, d) => { if (e) { r.writeHead(404); r.end(); } else { const t = { html: 'text/html', js: 'text/javascript', css: 'text/css', png: 'image/png' }[p.split('.').pop()] || 'application/octet-stream'; r.writeHead(200, { 'Content-Type': t }); r.end(d); } }); }).listen(8912);
const out = (...a) => console.log(...a); const errs = [];
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 860 } }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message)); page.on('console', m => m.type() === 'error' && !/404/.test(m.text()) && errs.push('console: ' + m.text())); await C.mockNet(page);
  let busquedas = 0, bbox = null;
  await page.route('**/nominatim.openstreetmap.org/**', r => { busquedas++; r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify([{ lat: '40.1255', lon: '-5.6', display_name: 'Jarandilla de la Vera, Cáceres, Extremadura, España' }]) }); });
  await page.route('**/overpass-api.de/**', r => { const d = r.request().postData() || ''; const m = /way\["highway"\].*?\(([-\d.,]+)\)/.exec(decodeURIComponent(d.replace(/\+/g, ' '))); if (m) bbox = m[1]; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ elements: C.fake.elements }) }); });
  await page.goto('http://localhost:8912/index.html'); await page.waitForFunction(() => window.__plano && window.__plano.net.ready);
  await page.click('[data-act=tab][data-t=plano]'); await page.fill('#zonaTxt', 'Jarandilla de la Vera'); await page.click('[data-act=zona-buscar]'); await page.waitForTimeout(800);
  const z = await page.evaluate(() => ({ centro: window.__plano.map.getCenter(), titulo: document.querySelector('#panel h3:nth-of-type(2)') && document.querySelector('#panel h3:nth-of-type(2)').textContent, listo: window.__plano.net.ready }));
  out('1. búsquedas:', busquedas, '| centro:', z.centro.lat.toFixed(3), z.centro.lng.toFixed(3), '| callejero listo:', z.listo, '| bbox pedido:', bbox);
  out('   panel:', await page.evaluate(() => [...document.querySelectorAll('#panel h3')].map(h => h.textContent).join(' / ')));
  await page.screenshot({ path: SC + '/130-localidad.png' });
  await page.reload(); await page.waitForFunction(() => window.__plano && window.__plano.net.ready); await page.click('[data-act=tab][data-t=plano]');
  out('2. tras recargar:', await page.evaluate(() => [...document.querySelectorAll('#panel h3')].map(h => h.textContent).join(' / ')), '| volver visible:', await page.locator('[data-act=zona-db]').count());
  await page.click('[data-act=zona-db]'); await page.waitForTimeout(800);
  out('3. de vuelta:', await page.evaluate(() => [...document.querySelectorAll('#panel h3')].map(h => h.textContent).join(' / ')), '| centro:', (await page.evaluate(() => window.__plano.map.getCenter().lat)).toFixed(3));
  out('ERRORES:', JSON.stringify(errs)); await b.close(); srv.close();
})();

/** Construye el informe sin recursos remotos y lo imprime con Edge en A4. */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const evidence = JSON.parse(await readFile(join(root, 'capturas/evidencias.json'), 'utf8'));
assert.equal(evidence.casos.length, 4);
const images = [...evidence.casos.map(item => item.captura), evidence.captura_documentos];
for (const image of images) {
  const contents = await readFile(join(root, image.archivo));
  assert.equal(createHash('sha256').update(contents).digest('hex'), image.sha256, 'La captura cambió después de su verificación.');
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const euro = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
const [size, sales, sellers, privacy] = evidence.casos;
const garments = evidence.documentos.documentos.find(document => document.tipo === 'prendas').registros;
const sourceLinks = ids => ids.map(escape).join(', ');
const quote = text => `<blockquote>${escape(text)}</blockquote>`;
const start = (label, title) => `<section class="sheet"><div class="eyebrow">ROPA DE SEGUNDA MANO · ${label}</div><h2>${title}</h2>`;
const figures = [
  ['01', 'Prendas disponibles en talla 38', 'Pregunta 1 · búsqueda en el catálogo', size.captura,
    'La consulta devuelve vaqueros rectos (22 €), falda midi negra (14 €) y americana de lino (24 €), con fotos de ejemplo y fuentes debajo. PRE005, calzado EU 38, no forma parte de esta selección.'],
  ['02', 'Importe de las ventas completadas', 'Pregunta 2 · cálculo con registros completos', sales.captura,
    'El asistente separa 49 € de prendas y 7 € de envío: total de 56 € en tres operaciones completadas. Las fuentes incluyen VEN004, cancelada, para justificar su exclusión. Se usa el precio acordado, no el publicado.'],
  ['03', 'Las prendas de cada vendedor', 'Pregunta 3 · relación entre dos documentos', sellers.captura,
    'La respuesta agrupa las 12 prendas bajo los cinco alias públicos y conserva todos los estados. Debajo aparecen los cinco registros de vendedores y los doce de prendas que sustentan la agrupación.'],
  ['04', 'Cuando la información no consta', 'Pregunta de control · identidad y contacto', privacy.captura,
    'La aplicación indica que no constan nombres reales ni datos de contacto. Las fuentes son las cabeceras completas de los tres documentos. La comprobación de estos campos ausentes se hace antes de llamar al modelo generativo.'],
  ['05', 'Biblioteca de documentos', 'Listado real · 3 documentos y 21 registros', evidence.captura_documentos,
    'Se muestran las tarjetas de prendas.csv, ventas.csv y vendedores.csv, sus filtros y los 21 registros con acceso al detalle. Las miniaturas son imágenes generadas de ejemplo; la información procede de SQLite.'],
];

const figurePages = figures.map(([number, title, subtitle, image, caption]) => `
  <section class="sheet figure-sheet"><div class="eyebrow">EVIDENCIA VISUAL · ${number} / 05</div>
  <h2>${title}</h2><p class="subtitle">${subtitle}</p>
  <figure><a href="${escape(image.archivo)}"><img src="${escape(image.archivo)}" alt="${escape(title)}: captura real de la aplicación" /></a>
  <figcaption><strong>Figura ${Number(number)}.</strong> ${caption}</figcaption></figure>
  <p class="small">Edge · ventana 1366 × 900 · captura completa ${image.ancho} × ${image.alto} px. Las zonas con desplazamiento se expanden para conservar toda la respuesta y sus fuentes. La imagen completa se puede abrir desde el HTML.</p></section>`).join('');

const sizeRows = size.respuesta.datos.prendas.map(row => `<tr><td>${escape(row.prenda_id)}</td><td>${escape(row.titulo)}</td><td>${euro(row.precio_publicado_eur)}</td><td>@${escape(row.alias)}</td></tr>`).join('');
const salesRows = sales.respuesta.datos.ventas_completadas.map(row => `<tr><td>${escape(row.venta_id)}</td><td>${euro(row.precio_acordado_eur)}</td><td>${euro(row.envio_eur)}</td><td>${euro(row.total_eur)}</td></tr>`).join('');
const sellerRows = sellers.respuesta.datos.vendedores.map(seller => `<tr><td><strong>${escape(seller.vendedor_id)}</strong><br>@${escape(seller.alias)}</td><td>${seller.prendas.map(row => `${escape(row.prenda_id)} · ${escape(row.titulo)} (${escape(row.disponibilidad)})`).join('<br>')}</td></tr>`).join('');

const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>ROPA DE SEGUNDA MANO — Entregable</title>
<style>
@page{size:A4;margin:14mm 14mm 16mm}
*{box-sizing:border-box}body{margin:0;color:#243d36;font:9.4pt/1.4 Arial,Helvetica,sans-serif;background:#e9ede6}a{color:#28634e}h1,h2,h3,p{margin-top:0}h1{font-size:39pt;line-height:1.04;letter-spacing:-1.6pt;font-weight:600;margin-bottom:7mm}h2{font-size:22pt;line-height:1.12;letter-spacing:-.5pt;margin:3mm 0 4mm}h3{font-size:12pt;margin:5mm 0 2mm}p{margin-bottom:3mm}.eyebrow{font-size:8pt;letter-spacing:1.2pt;font-weight:bold;color:#5b7867}.sheet{width:182mm;height:264mm;margin:0;background:white;break-after:page;page-break-after:always;position:relative}.sheet:last-child{break-after:auto;page-break-after:auto}.cover{display:flex;flex-direction:column;padding-top:12mm}.brand{font-size:24pt;letter-spacing:-1.5pt;color:#28634e;font-weight:bold;margin:0 0 24mm}.cover .tagline{font-size:15pt;line-height:1.35;max-width:150mm;color:#607067;margin-bottom:9mm}.cover-block{padding:5mm 0;border-top:1px solid #dfe5db}.cover-block h3{margin:0 0 3mm}.cover-bottom{margin-top:auto;border-top:2px solid #28634e;padding-top:5mm;display:flex;justify-content:space-between;color:#607067;font-size:9pt}.stats{display:flex;gap:4mm;margin:4mm 0 8mm}.stat{background:#edf3eb;padding:4mm;flex:1;border-radius:2mm}.stat strong{display:block;font-size:19pt;font-weight:500}.stat span{font-size:8pt}.subtitle{color:#607067;font-size:10pt}.figure-sheet figure{margin:3mm 0;break-inside:avoid;page-break-inside:avoid}.figure-sheet img{display:block;width:100%;height:198mm;object-fit:contain;object-position:center top;border:1px solid #e5e9e0;background:#fafbf8}.figure-sheet figcaption{font-size:9.3pt;line-height:1.4;padding:4mm 0 0;break-inside:avoid}.small{font-size:8pt;color:#607067}.question{font-weight:bold;border-left:2px solid #28634e;padding-left:3mm;margin-bottom:2mm}blockquote{margin:2mm 0 3mm;padding:3mm 4mm;background:#f4f6f0;border-left:2px solid #cbd9c2;font-size:8.8pt;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;font-size:8.6pt;margin:3mm 0}th,td{text-align:left;padding:2mm;border-bottom:1px solid #e3e8df;vertical-align:top}th{background:#edf3eb;font-size:8pt}.result{color:#28634e;font-weight:bold}.manual{font-size:8.8pt;line-height:1.4}.notice{padding:3mm 4mm;border-left:3px solid #c89b64;background:#fcf7ef;font-size:8.8pt;margin:3mm 0}.check-section{break-inside:avoid}.tech-grid{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.tech-card{padding:4mm;background:#f4f6f0;border:1px solid #e0e7da;border-radius:2mm}.tech-card h3{margin:0 0 2mm}.flow{display:flex;gap:2mm;margin:4mm 0 6mm}.flow div{flex:1;border:1px solid #dbe4d4;background:#edf3eb;padding:3mm;font-size:8.4pt;border-radius:2mm}.flow strong{display:block;margin-bottom:1mm}code{font-family:Consolas,monospace;font-size:.94em}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f4f6f0;border:1px solid #e0e7da;padding:4mm;font:8.8pt/1.5 Consolas,monospace}.spacer{margin-top:6mm}.source-note{font-size:8.5pt;padding:3mm;background:#edf3eb}.vendor-table{font-size:8.2pt}.vendor-table td{padding:1.8mm}
.tech-card p{margin-bottom:2mm}
@media screen{.sheet{width:210mm;height:294mm;padding:14mm;margin:8mm auto;box-shadow:0 2mm 7mm #243d361c}.cover{padding-top:26mm}}
@media print{body{background:white;-webkit-print-color-adjust:exact;print-color-adjust:exact}a{color:inherit;text-decoration:none}figure,img,figcaption{break-inside:avoid;page-break-inside:avoid}}
</style></head><body>
<section class="sheet cover"><div class="eyebrow">PROYECTO FINAL · CURSO IA · 16 OCTUBRE 2026</div><div class="brand">loop</div>
<h1>ROPA DE<br>SEGUNDA MANO</h1><p class="tagline">Un asistente para consultar una colección, comprender sus ventas y comprobar cada respuesta.</p>
<div class="cover-block"><h3>Qué problema resuelve</h3><p>Consultar prendas y calcular ventas en registros separados obliga a buscar y cruzar datos a mano. Este proyecto permite hacerlo en un chat que muestra las fuentes y reconoce cuándo no dispone de la información.</p></div>
<div class="stats"><div class="stat"><strong>12</strong><span>prendas</span></div><div class="stat"><strong>5</strong><span>vendedores</span></div><div class="stat"><strong>4</strong><span>operaciones</span></div><div class="stat"><strong>21</strong><span>registros</span></div></div>
<div class="cover-block"><h3>De dónde salen los datos</h3><p>Son datos ficticios incluidos en <code>maquetas.html</code>, con corte de colección del 16/10/2026. Se prepararon como <code>prendas.csv</code>, <code>ventas.csv</code> y <code>vendedores.csv</code> y se importaron a <code>datos/loop.sqlite3</code>, que es la fuente actual de la aplicación.</p><p>No hay conexión real a Vinted ni acceso a anuncios de terceros. Las fotos de las prendas son imágenes de ejemplo generadas con IA.</p></div>
<div class="cover-bottom"><span>Memoria y evidencias de funcionamiento</span><span>Python · RAG · SQLite · Svelte</span></div></section>

${figurePages}

${start('VERIFICACIÓN · 1 / 2', 'Cómo lo comprobé')}
<p>Las consultas se enviaron desde el formulario, sin respuestas simuladas. El script esperó el HTTP 200 de <code>/api/preguntar</code>, la respuesta visible y todos sus botones de fuente; después contrastó cada fragmento con <code>/api/documentos</code>.</p>
<div class="check-section"><h3>1. Buscar prendas por talla</h3><p class="question">${escape(size.pregunta)}</p>${quote(size.respuesta.respuesta)}
<table><thead><tr><th>Registro</th><th>Prenda</th><th>Precio</th><th>Alias</th></tr></thead><tbody>${sizeRows}</tbody></table>
<p class="result">Coincide: tres prendas disponibles de talla 38, con sus precios y alias.</p><p class="manual"><strong>Fuentes que debes abrir:</strong> en Documentos, busca <strong>PRE002, PRE007 y PRE011</strong> y pulsa la flecha de detalle. Comprueba talla y disponibilidad; para los alias abre <strong>V002, V003 y V001</strong>, respectivamente. PRE005 permite confirmar que el calzado tiene talla <em>EU 38</em> y queda excluido.</p></div>
<div class="check-section"><h3>2. Calcular las ventas completadas</h3><p class="question">${escape(sales.pregunta)}</p>${quote(sales.respuesta.respuesta)}
<table><thead><tr><th>Venta</th><th>Prenda acordada</th><th>Envío</th><th>Total</th></tr></thead><tbody>${salesRows}</tbody></table>
<p class="result">Coincide: 17 + 10 + 22 = 49 €; 3,50 + 0 + 3,50 = 7 €; total 56 €.</p><p class="manual"><strong>Fuentes que debes abrir:</strong> <strong>ventas.csv · VEN001, VEN002 y VEN003</strong>, todas completadas; después <strong>VEN004</strong>, cancelada y excluida. El total no es un beneficio neto: los documentos no contienen comisiones.</p></div>
</section>

${start('VERIFICACIÓN · 2 / 2', 'Cómo lo comprobé')}
<h3>3. Relacionar prendas y vendedores</h3><p class="question">${escape(sellers.pregunta)}</p><p><strong>Lo que respondió:</strong> agrupó las 12 prendas por los cinco alias, incluyendo prendas disponibles, vendidas, reservadas y retiradas. Esta tabla resume el contenido estructurado de la respuesta real:</p>
<table class="vendor-table"><thead><tr><th>Fuente del vendedor</th><th>Prendas que debes abrir en prendas.csv</th></tr></thead><tbody>${sellerRows}</tbody></table>
<p class="manual"><strong>Cómo confirmarlo:</strong> abre <strong>V001 a V005</strong> en Documentos y compara el campo <code>vendedor_id</code> con los registros de prendas indicados en cada fila. Los alias, las asociaciones y los estados coinciden con las fuentes citadas.</p>
<div class="notice"><strong>Matiz detectado en la redacción:</strong> el modelo empleó «vendedor» y «vendedora». Las fuentes solo contienen identificador y alias; no acreditan género ni identidad. Se consideran comprobados los registros y sus relaciones, no esa atribución.</div>
<h3>4. Pregunta que no debe saber responder</h3><p class="question">${escape(privacy.pregunta)}</p>${quote(privacy.respuesta.respuesta)}
<p class="result">Coincide con el alcance de los documentos: estado <code>no_consta</code>.</p><p class="manual"><strong>Fuentes que debes abrir:</strong> vuelve a preguntar por los datos personales en el chat y abre <strong>vendedores.csv · Cabecera completa</strong>, <strong>prendas.csv · Cabecera completa</strong> y <strong>ventas.csv · Cabecera completa</strong>. En vendedores solo hay <code>vendedor_id</code> y <code>alias</code>; también puedes abrir V001 en Documentos para comprobar su registro completo. No hay nombres reales, correos, teléfonos ni direcciones en la colección.</p>
<div class="source-note"><strong>Resultado global.</strong> Las 30 referencias de fuente de las cuatro respuestas coinciden con los registros o cabeceras de la API. El listado contiene 12 prendas, 4 ventas y 5 vendedores. Para revisar a mano, abre <a href="http://127.0.0.1:5173/#registros">http://127.0.0.1:5173/#registros</a> y busca el ID. Las respuestas y comprobaciones completas están en <a href="capturas/evidencias.json">capturas/evidencias.json</a>.</div>
</section>

${start('IMPLEMENTACIÓN', 'Cómo está hecho')}
<p>La interfaz consulta un servidor Python. El RAG recupera evidencia de la colección antes de redactar la respuesta y conserva las fuentes para que se puedan comprobar.</p>
<div class="flow"><div><strong>1 · Pregunta</strong>Svelte envía pregunta e historial.</div><div><strong>2 · Recuperación</strong>Embeddings y búsqueda coseno en SQLite.</div><div><strong>3 · Evidencia</strong>Registros y cálculos completos.</div><div><strong>4 · Respuesta</strong>Salida estructurada y fuentes verificadas.</div></div>
<div class="tech-grid"><div class="tech-card"><h3>Servidor Python</h3><p><code>servidor.py</code> utiliza FastAPI y Pydantic. <code>POST /api/preguntar</code> recibe la pregunta y el historial; <code>GET /api/documentos</code> devuelve los documentos y sus registros.</p><p>Las sumas se calculan con <code>Decimal</code> y las agrupaciones abarcan las tablas completas, sin depender de un top-k parcial.</p></div>
<div class="tech-card"><h3>Interfaz Svelte</h3><p><code>web/</code> utiliza Svelte y Vite. Incluye chat, fuentes desplegables en un diálogo, aviso de ausencia de datos, documentos y ventas.</p><p>La interfaz solo utiliza las rutas <code>/api</code>. La clave permanece en el <code>.env</code> del servidor y no llega al navegador.</p></div>
<div class="tech-card"><h3>Base e índice persistente</h3><p>SQLite guarda prendas, ventas, vendedores y 29 fragmentos con embeddings. El índice se reutiliza y se actualizan únicamente los fragmentos afectados por cambios.</p><p>La búsqueda coseno se ejecuta mediante SQL con una función registrada desde Python; es una búsqueda exacta para esta colección pequeña.</p></div>
<div class="tech-card"><h3>Modelos de esta ejecución</h3><p><strong>Respuesta:</strong> <code>${escape(evidence.configuracion.chat_model)}</code>.</p><p><strong>Embeddings:</strong> <code>${escape(evidence.configuracion.embedding_model)}</code>.</p><p><strong>Umbral coseno:</strong> ${evidence.configuracion.umbral}. Sin evidencia similar no se llama al modelo generativo. La ausencia de datos personales se comprueba antes incluso de generar un embedding de consulta.</p></div></div>
<h3 class="spacer">Cómo reproducirlo</h3><p>Desde la carpeta del proyecto, con las dependencias instaladas, abre dos terminales:</p>
<pre>Terminal 1: uv run servidor.py
Terminal 2: cd web
            npm run dev
Abrir:      http://127.0.0.1:5173/</pre>
<p>Para repetir el entregable, desde <code>web/</code>:</p><pre>node capturas.mjs
node entregable.mjs</pre>
<p class="small">La instalación usa <code>npm install -D playwright-core</code> y el Edge ya instalado con <code>channel: "msedge"</code>; no se descargan navegadores. Las 22 pruebas automatizadas de Python pasaron al preparar este documento. Las capturas se obtuvieron con Edge ${escape(evidence.navegador.version)}, con una ventana de 1366 × 900 y sin sustituir las respuestas del servidor.</p>
</section></body></html>`;

const htmlPath = join(root, 'entregable.html');
const pdfPath = join(root, 'entregable.pdf');
await writeFile(htmlPath, html, 'utf8');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const remoteRequests = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) remoteRequests.push(request.url()); });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await page.emulateMedia({ media: 'print' });
  await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('img').count(), 5);
  assert.deepEqual(remoteRequests, [], 'El entregable no debe cargar recursos externos.');
  const overflow = await page.locator('.sheet').evaluateAll(sheets => sheets.map((sheet, index) => ({
    pagina: index + 1, alto: sheet.clientHeight, contenido: sheet.scrollHeight,
  })).filter(sheet => sheet.contenido > sheet.alto + 2));
  assert.deepEqual(overflow, [], 'El contenido desborda una página A4. Ajusta el diseño antes de imprimir.');
  const pdf = await page.pdf({ path: pdfPath, format: 'A4', printBackground: true, preferCSSPageSize: true,
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font:8px Arial;color:#607067;margin:0 14mm;display:flex;justify-content:space-between"><span>ROPA DE SEGUNDA MANO · 16/10/2026</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
  });
  const pages = [...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)].length;
  assert.equal(pages, 9, 'El informe debe contener nueve páginas, sin cortes ni páginas en blanco.');
  await writeFile(join(root, 'capturas/resumen-entregable.json'), JSON.stringify({
    html: 'entregable.html', pdf: 'entregable.pdf', paginas: pages, formato: 'A4',
    capturas: 5, sin_recursos_externos: true, sin_desbordamiento: true,
    navegador: 'msedge', pdf_sha256: createHash('sha256').update(pdf).digest('hex'),
  }, null, 2) + '\n');
  console.log(`HTML y PDF generados: ${pages} páginas A4, 5 imágenes completas, sin recursos externos.`);
} finally {
  await browser.close();
}

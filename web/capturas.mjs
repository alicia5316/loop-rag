/** Capturas reales con Edge instalado. Ejecutar desde web/: node capturas.mjs */
import { chromium } from 'playwright-core';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const web = dirname(fileURLToPath(import.meta.url));
const root = resolve(web, '..');
const output = join(root, 'capturas');
const baseURL = 'http://127.0.0.1:5173';
const viewport = { width: 1366, height: 900 };
const specification = await readFile(join(root, 'maquetas.html'), 'utf8');
const questions = [...specification.matchAll(/<div class="question"><p>(.*?)<\/p>/gs)].map(match => match[1]);
assert.equal(questions.length, 4, 'La maqueta debe contener las cuatro preguntas de ejemplo.');
const files = ['01-chat-talla38.png', '02-chat-ventas.png', '03-chat-vendedores.png', '04-chat-no-consta.png'];
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const idOf = row => row.venta_id || row.prenda_id || row.vendedor_id;
const cents = (rows, field) => rows.reduce((sum, row) => sum + Math.round(row[field] * 100), 0);

// Solo se consulta configuración no secreta; nunca se lee ni se exporta la clave.
const python = join(root, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const configuration = JSON.parse(execFileSync(python, ['-c',
  'import json; from servidor import CHAT_MODEL, EMBEDDING_MODEL, MIN_SIMILARITY; print(json.dumps(dict(chat_model=CHAT_MODEL, embedding_model=EMBEDDING_MODEL, umbral=MIN_SIMILARITY)))',
], { cwd: root, encoding: 'utf8' }));

function checkSources(answer, documents) {
  assert.ok(answer.fuentes.length > 0, 'La respuesta debe tener fuentes reales.');
  return answer.fuentes.map(source => {
    const document = documents.find(document => document.nombre === source.documento);
    assert.ok(document, `Documento desconocido: ${source.documento}`);
    if (source.registro_id === 'cabecera') {
      assert.deepEqual(source.fragmento.split(', '), document.campos);
    } else {
      const row = document.registros.find(row => idOf(row) === source.registro_id);
      assert.ok(row, `Registro desconocido: ${source.registro_id}`);
      assert.equal(canonical(JSON.parse(source.fragmento)), canonical(row), `La fuente ${source.registro_id} difiere del registro real.`);
    }
    return { documento: source.documento, registro_id: source.registro_id, coincide: true };
  });
}

function checkAnswer(index, answer, documents) {
  const garments = documents.find(document => document.tipo === 'prendas').registros;
  const sales = documents.find(document => document.tipo === 'ventas').registros;
  const sellers = documents.find(document => document.tipo === 'vendedores').registros;
  assert.equal(answer.estado, index === 3 ? 'no_consta' : 'ok');
  if (index === 0) {
    const expected = garments.filter(row => row.talla === '38' && row.disponibilidad === 'Disponible');
    assert.deepEqual(answer.datos.prendas.map(row => row.prenda_id).sort(), expected.map(row => row.prenda_id).sort());
    for (const row of expected) {
      assert.ok(answer.respuesta.includes(row.titulo), `Falta ${row.titulo} en la respuesta escrita.`);
      assert.ok(answer.fuentes.some(source => source.registro_id === row.prenda_id));
    }
    return `Coinciden las ${expected.length} prendas disponibles de talla 38. EU 38 queda fuera.`;
  }
  if (index === 1) {
    const completed = sales.filter(row => row.estado === 'Completada');
    assert.equal(answer.datos.numero_ventas, completed.length);
    for (const field of ['precio_acordado_eur', 'envio_eur', 'total_eur']) {
      assert.equal(Math.round(answer.datos[field] * 100), cents(completed, field));
    }
    assert.ok(answer.respuesta.includes('56') && answer.respuesta.includes('49') && /\b7(?:[,.]0+)?\b/.test(answer.respuesta));
    return 'Coinciden 3 ventas completadas: 49,00 € de prendas + 7,00 € de envío = 56,00 €. VEN004 queda excluida.';
  }
  if (index === 2) {
    assert.equal(answer.datos.vendedores.length, sellers.length);
    for (const seller of answer.datos.vendedores) {
      assert.equal(canonical(seller.prendas), canonical(garments.filter(row => row.vendedor_id === seller.vendedor_id)));
      assert.ok(answer.respuesta.includes(seller.alias));
    }
    return 'Coinciden los 5 vendedores y las 12 prendas, incluidos todos sus estados.';
  }
  assert.ok(answer.respuesta.includes('No constan datos personales'));
  assert.deepEqual(answer.datos, {});
  assert.deepEqual(sellers.map(row => Object.keys(row)), sellers.map(() => ['vendedor_id', 'alias']));
  assert.equal(answer.fuentes.length, 3);
  return 'La ausencia de identidad y contacto coincide con las cabeceras completas de los tres documentos.';
}

async function screenshot(page, filename) {
  // Solo se expanden zonas desplazables; no se ocultan respuestas ni se sustituyen datos.
  await page.addStyleTag({ content: '.conversation,.table-scroll{max-height:none!important;overflow:visible!important;scroll-behavior:auto!important} html{scroll-behavior:auto!important}' });
  await page.locator('img').evaluateAll(images => Promise.all(images.map(async image => {
    image.loading = 'eager';
    await image.decode();
    if (!image.naturalWidth) throw new Error('Hay una imagen sin cargar.');
  })));
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
    document.querySelectorAll('.conversation,.table-scroll').forEach(element => element.scrollTop = 0);
    document.activeElement?.blur();
  });
  const path = join(output, filename);
  await page.screenshot({ path, fullPage: true, animations: 'disabled' });
  const png = await readFile(path);
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  assert.equal(width, viewport.width);
  assert.ok(height >= viewport.height);
  console.log(`Captura verificada: ${filename} (${width} × ${height})`);
  return { archivo: `capturas/${filename}`, ancho: width, alto: height, sha256: createHash('sha256').update(png).digest('hex') };
}

await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--window-size=1366,900'] });
const context = await browser.newContext({ viewport, locale: 'es-ES', timezoneId: 'Europe/Madrid', reducedMotion: 'reduce' });
const evidence = { proyecto: 'ROPA DE SEGUNDA MANO', fecha: '2026-10-16',
  generado: new Date().toISOString(), navegador: { canal: 'msedge', version: browser.version() },
  viewport, url: baseURL, configuracion: configuration, casos: [] };
const errors = [];
try {
  let collection;
  for (const [index, question] of questions.entries()) {
    // Cada captura muestra una consulta independiente, enviada desde el formulario real.
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    const documentsResponse = page.waitForResponse(response => response.url().endsWith('/api/documentos'));
    await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
    const documents = await documentsResponse;
    assert.equal(documents.status(), 200);
    const currentCollection = await documents.json();
    collection ??= currentCollection;
    assert.equal(canonical(currentCollection), canonical(collection), 'Los registros cambiaron durante la captura.');
    const responsePromise = page.waitForResponse(response => response.url().endsWith('/api/preguntar') && response.request().method() === 'POST', { timeout: 110000 });
    await page.getByRole('textbox', { name: 'Escribe tu consulta' }).fill(question);
    await page.getByRole('button', { name: 'Enviar consulta', exact: true }).click();
    const response = await responsePromise;
    assert.equal(response.status(), 200, `Error HTTP en pregunta ${index + 1}.`);
    const answer = await response.json();
    const matchedSources = checkSources(answer, collection.documentos);
    const validation = checkAnswer(index, answer, collection.documentos);
    await page.locator('.answer').waitFor();
    await page.locator('.conversation[aria-busy="false"]').waitFor();
    const rendered = await page.locator(index === 3 ? '.no-data span' : '.answer-text').innerText();
    assert.equal(rendered.trim(), answer.respuesta.trim());
    assert.equal(await page.locator('.answer .source').count(), answer.fuentes.length);
    assert.equal(await page.locator('.welcome').count(), 0, 'No se permite una captura de la pantalla vacía.');
    const image = await screenshot(page, files[index]);
    evidence.casos.push({ pregunta: question, respuesta: answer, captura: image,
      verificacion: { resultado: validation, fuentes: matchedSources, coincide_con_api: true } });
    await page.close();
  }
  const page = await context.newPage();
  const loaded = page.waitForResponse(response => response.url().endsWith('/api/documentos'));
  await page.goto(`${baseURL}/#registros`, { waitUntil: 'domcontentloaded' });
  assert.equal((await loaded).status(), 200);
  await page.getByText('21 de 21 registros', { exact: true }).waitFor();
  assert.equal(await page.locator('tbody tr').count(), collection.total_registros);
  evidence.documentos = collection;
  evidence.captura_documentos = await screenshot(page, '05-documentos.png');
  assert.deepEqual(errors, [], 'Se han producido errores de JavaScript.');
  await writeFile(join(output, 'evidencias.json'), JSON.stringify(evidence, null, 2) + '\n');
  console.log('5 capturas completas, respuestas reales y todas las fuentes contrastadas con /api/documentos.');
} finally {
  await browser.close();
}

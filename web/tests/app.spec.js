import { test, expect } from '@playwright/test';

test('documentos: filtros, búsqueda, registro y exportación', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#registros');
  await expect(page.getByRole('status')).toContainText('21 de 21 registros');
  await page.getByRole('button', { name: 'prendas 12', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('12 de 21');
  await page.getByRole('searchbox').fill('ana.rewear');
  await expect(page.getByRole('status')).toContainText('3 de 21');
  await page.getByRole('button', { name: 'Abrir registro PRE001', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Camiseta básica de algodón');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar selección' }).click();
  expect((await download).suggestedFilename()).toBe('loop-registros.csv');
  await page.getByRole('searchbox').fill('no-existe-123');
  await expect(page.getByText('No hay registros que coincidan.', { exact: false })).toBeVisible();
  expect(errors).toEqual([]);
});

test('chat real: tres preguntas, fuentes, historial y no consta', async ({ page }) => {
  const apiRequests = [];
  const external = [];
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (request.url().includes('/api/preguntar')) apiRequests.push(request.postDataJSON());
    if (!request.url().startsWith('http://127.0.0.1:5173') && !request.url().startsWith('ws://127.0.0.1:5173')) external.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Talla 38 disponible', exact: true }).click();
  await expect(page.locator('.answer')).toHaveCount(1, { timeout: 100000 });
  await expect(page.locator('.product')).toHaveCount(3);
  await page.locator('.source').first().click();
  await expect(page.getByRole('dialog')).toContainText('prendas.csv');
  await page.getByRole('button', { name: 'Cerrar detalle' }).click();
  await page.getByRole('button', { name: 'Ventas completadas', exact: true }).click();
  await expect(page.locator('.answer')).toHaveCount(2, { timeout: 100000 });
  await expect(page.locator('.answer-metrics')).toContainText('56,00');
  await page.getByRole('button', { name: 'Prendas por vendedor', exact: true }).click();
  await expect(page.locator('.seller-row')).toHaveCount(5, { timeout: 100000 });
  await page.getByRole('button', { name: 'Datos personales', exact: true }).click();
  await expect(page.locator('.no-data')).toContainText('No constan datos personales');
  await expect(page.locator('.no-data')).toBeInViewport();
  await expect(page.locator('.answer').last().locator('.source')).toHaveCount(3);
  expect(apiRequests[1].historial).toHaveLength(2);
  expect(apiRequests[3].historial).toHaveLength(6);
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'test-results/chat-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Nueva conversación' }).click();
  await expect(page.locator('.answer')).toHaveCount(0);
  await expect(page.getByText('¿Qué encontramos hoy?')).toBeVisible();
});

test('privacidad y ventas muestran los datos del servidor', async ({ page }) => {
  await page.goto('/#privacidad');
  await page.getByRole('button', { name: 'Consultar datos personales' }).click();
  await expect(page.locator('.no-data')).toContainText('No constan datos personales');
  await page.getByRole('link', { name: 'Ventas', exact: true }).click();
  await expect(page.locator('.sales-metrics')).toContainText('56,00');
  await page.getByRole('combobox').selectOption('Cancelada');
  await expect(page.locator('.sales-metric.total')).toContainText('0,00');
  await expect(page.locator('.sales-table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Abrir registro VEN004' }).click();
  await expect(page.getByRole('dialog')).toContainText('Cancelada');
});

test('errores recuperables de documentos y chat', async ({ page }) => {
  await page.route('**/api/documentos', route => route.fulfill({ status: 503, body: '{}' }));
  await page.goto('/#registros');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/documentos');
  await page.getByRole('button', { name: 'Reintentar cargar documentos' }).click();
  await expect(page.getByRole('status')).toContainText('21 de 21');
  await page.getByRole('link', { name: 'Asistente', exact: true }).click();
  await page.route('**/api/preguntar', route => route.fulfill({ status: 503, body: '{}' }));
  await page.getByRole('button', { name: 'Datos personales', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.unroute('**/api/preguntar');
  await page.getByRole('button', { name: 'Reintentar pregunta' }).click();
  await expect(page.locator('.no-data')).toBeVisible();
});

test('móvil: navegación, documentos y ausencia de desbordamiento', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#registros');
  await expect(page.getByRole('status')).toContainText('21 de 21');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/documentos-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Asistente', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Escribe tu consulta' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

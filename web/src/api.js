async function request(path, options = {}) {
  try {
    const response = await fetch(path, { ...options, signal: AbortSignal.timeout(100000) });
    if (!response.ok) throw new Error('No hemos podido consultar tu colección. Inténtalo de nuevo en unos instantes.');
    return await response.json();
  } catch (error) {
    if (error.name === 'TimeoutError') throw new Error('La consulta está tardando demasiado. Vuelve a intentarlo.');
    if (error instanceof TypeError) throw new Error('No se pudo conectar con tu colección. Comprueba que el servidor esté en marcha.');
    throw error;
  }
}

export const getDocuments = () => request('/api/documentos');
export const ask = (pregunta, historial) => request('/api/preguntar', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ pregunta, historial }),
});

export const euro = value => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(value);
export const normalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const recordId = row => row.prenda_id && !row.venta_id ? row.prenda_id : row.venta_id || row.vendedor_id;
export const recordTitle = row => row.titulo || (row.venta_id ? `Venta ${row.venta_id} · ${row.prenda_id}` : `@${row.alias}`);

export function downloadCSV(filename, rows) {
  if (!rows.length) return;
  const columns = [...new Set(rows.flatMap(row => Object.keys(row)))];
  const cell = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const content = '\uFEFF' + [columns.map(cell).join(';'), ...rows.map(row => columns.map(key => cell(row[key])).join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

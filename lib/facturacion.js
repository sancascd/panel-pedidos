// Lo que comparten las pantallas de facturas (restaurante y administradora).
// Emitir, descargar y exportar lo hace el bot: aquí solo se le pide.

export function euros(n) {
  return (Number(n) || 0).toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });
}

export function fechaCorta(texto) {
  if (!texto) return '';
  const [a, m, d] = String(texto).slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

export function periodoTexto(f) {
  if (!f || !f.periodo_inicio) return '—';
  return `${fechaCorta(f.periodo_inicio)} – ${fechaCorta(f.periodo_fin)}`;
}

export async function pedirAlBot(ruta, cuerpo) {
  const r = await fetch('/api/bot-proxy/facturacion/' + ruta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo || {}),
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(datos.error || 'No se ha podido completar');
  return datos;
}

// Enlace firmado de pocos minutos: se abre al momento.
export async function descargarPdf(facturaId) {
  const { url } = await pedirAlBot('descargar', { factura_id: facturaId });
  const a = document.createElement('a');
  a.href = url;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function guardarBase64(nombre, base64, tipo) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import MenuNav from '@/components/MenuNav';
import {
  ArrowLeft, Receipt, Loader2, AlertCircle, CheckCircle2, Download, FileSpreadsheet,
  CalendarClock, Users, Building2, Plus, Pencil, Undo2, Send, Play, X, Trash2
} from 'lucide-react';
import { euros, fechaCorta, periodoTexto, pedirAlBot, descargarPdf, guardarBase64 } from '@/lib/facturacion';
import { errorNif, limpiarNif } from '@/lib/nif';

// Facturación de Comandi, solo para la administradora. Leer va por funciones
// de la base de datos que comprueban soy_superadmin(); emitir, descargar y
// exportar lo hace el bot (lib/facturacion). Las facturas no se pueden
// cambiar ni borrar: un error se corrige con una rectificativa.

const SECCIONES = [
  { id: 'facturas', label: 'Facturas emitidas', icono: Receipt },
  { id: 'proximas', label: 'Próximas facturas', icono: CalendarClock },
  { id: 'clientes', label: 'Clientes de facturación', icono: Users },
  { id: 'emisor',   label: 'Datos del emisor', icono: Building2 },
];

const CONCEPTO_DEFECTO = 'Suscripción Comandi – asistente de pedidos por WhatsApp';

function hoyTexto() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

const CLIENTE_VACIO = {
  restaurante_id: '', razon_social: '', nif: '', direccion: '', cp: '', ciudad: 'Córdoba', provincia: 'Córdoba',
  concepto: CONCEPTO_DEFECTO, importe: '99', iva_incluido: true, iva_pct: '21',
  frecuencia: 'mensual', cada_dias: '30', fecha_inicio: '', fecha_fin: '', activo: true, notas: '', tramos: [],
};

export default function PaginaFacturacion() {
  const router = useRouter();
  const supabase = crearClienteSupabase();
  const [cargando, setCargando] = useState(true);
  const [seccion, setSeccion] = useState('facturas');
  const [mensaje, setMensaje] = useState({ texto: '', tipo: 'success' });
  const [ocupado, setOcupado] = useState('');

  const [restaurantes, setRestaurantes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [exportadas, setExportadas] = useState({});
  const [proximas, setProximas] = useState(null);
  const [emisor, setEmisor] = useState(null);

  const anio = hoyTexto().slice(0, 4);
  const [filtro, setFiltro] = useState({ desde: `${anio}-01-01`, hasta: `${anio}-12-31`, restaurante: '' });
  const [soloNuevas, setSoloNuevas] = useState(true);

  const [editando, setEditando] = useState(null);      // { id, datos }
  const [suelta, setSuelta] = useState(null);          // { cliente, concepto, importe, iva_incluido, iva_pct }
  const [rectificando, setRectificando] = useState(null); // { factura, motivo }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: admin } = await supabase.rpc('soy_superadmin');
      if (admin !== true) { router.push('/pedidos'); return; }
      await Promise.all([cargarRestaurantes(), cargarClientes(), cargarFacturas(), cargarEmisor()]);
      setCargando(false);
    }
    init();
  }, []);

  useEffect(() => { if (seccion === 'proximas' && proximas === null) cargarProximas(); }, [seccion]);

  function avisar(texto, tipo = 'success') {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: 'success' }), 7000);
  }

  async function cargarRestaurantes() {
    const { data } = await supabase.from('restaurantes').select('id, nombre, es_demo').order('nombre');
    setRestaurantes((data || []).filter(r => !r.es_demo));
  }
  async function cargarClientes() {
    const { data, error } = await supabase.rpc('admin_clientes_facturacion');
    if (error) avisar('Clientes de facturación: ' + error.message, 'error');
    setClientes(data || []);
  }
  async function cargarFacturas() {
    const { data, error } = await supabase.rpc('admin_facturas', {
      p_desde: filtro.desde || null, p_hasta: filtro.hasta || null, p_restaurante: filtro.restaurante || null,
    });
    if (error) { avisar('Facturas: ' + error.message, 'error'); return; }
    setFacturas(data || []);
    const { data: exp } = await supabase.rpc('admin_facturas_exportadas');
    setExportadas(Object.fromEntries((exp || []).map(e => [e.factura_id, e.exportado_en])));
  }
  async function cargarEmisor() {
    const { data, error } = await supabase.rpc('admin_facturacion_config');
    if (error) avisar('Datos del emisor: ' + error.message, 'error');
    setEmisor(data || {});
  }
  async function cargarProximas() {
    try { setProximas((await pedirAlBot('proximas', { dias: 30 })).proximas || []); }
    catch (e) { avisar(e.message, 'error'); setProximas([]); }
  }

  async function conOcupado(clave, fn) {
    setOcupado(clave);
    try { await fn(); } catch (e) { avisar(e.message, 'error'); } finally { setOcupado(''); }
  }

  const nombreRestaurante = useMemo(
    () => Object.fromEntries(restaurantes.map(r => [r.id, r.nombre])), [restaurantes]);
  const numeroPorId = useMemo(() => Object.fromEntries(facturas.map(f => [f.id, f.numero])), [facturas]);
  const rectificadas = useMemo(() => new Set(facturas.map(f => f.rectifica_factura_id).filter(Boolean)), [facturas]);
  // Las sustituidas (rectificadas por sustitución) no suman: su rectificativa
  // ya lleva el mismo importe.
  const totales = useMemo(() => facturas.filter(f => !f.sustituida).reduce((t, f) => ({
    base: t.base + Number(f.base), cuota: t.cuota + Number(f.cuota_iva), total: t.total + Number(f.total),
  }), { base: 0, cuota: 0, total: 0 }), [facturas]);
  const faltaEmisor = emisor && (!emisor.razon_social || !emisor.cif || !emisor.domicilio || !emisor.registro_mercantil);

  // ---------- Acciones ----------
  function exportarExcel() {
    conOcupado('excel', async () => {
      const r = await pedirAlBot('excel', { desde: filtro.desde, hasta: filtro.hasta, solo_nuevas: soloNuevas });
      guardarBase64(r.nombre, r.base64, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      avisar(`Excel descargado con ${r.facturas} facturas` + (r.nuevas < r.facturas ? ` (${r.facturas - r.nuevas} ya se habían exportado antes).` : '.'));
      await cargarFacturas();
    });
  }

  function emitirAhora(cliente) {
    if (!confirm(`¿Emitir ahora las facturas pendientes de ${cliente.razon_social}?\n\nSolo se emiten los periodos que ya han empezado y no tienen factura.`)) return;
    conOcupado('emitir-' + cliente.id, async () => {
      const r = await pedirAlBot('emitir-ahora', { cliente_id: cliente.id });
      avisar(r.facturas.length ? `Emitidas: ${r.facturas.map(f => f.numero).join(', ')}` : 'No tenía ningún periodo pendiente.');
      await cargarFacturas();
      setProximas(null);
      if (seccion === 'proximas') await cargarProximas();
    });
  }

  function ejecutarProceso() {
    conOcupado('proceso', async () => {
      const r = await pedirAlBot('ejecutar');
      if (r.ocupado) { avisar('El proceso ya se está ejecutando. Prueba en un minuto.', 'error'); return; }
      avisar(`Proceso hecho: ${r.emitidas.length} emitidas, ${r.errores.length} errores.` +
        (r.errores.length ? ' ' + r.errores.map(e => `${e.cliente}: ${e.error}`).join(' · ') : ''), r.errores.length ? 'error' : 'success');
      await cargarFacturas();
      await cargarProximas();
    });
  }

  function emitirSuelta() {
    const importe = Number(String(suelta.importe).replace(',', '.'));
    if (!suelta.concepto.trim() || !(importe > 0)) { avisar('Pon concepto e importe.', 'error'); return; }
    if (!confirm(`¿Emitir una factura de ${euros(importe)}${suelta.iva_incluido ? ' (IVA incluido)' : ' + IVA'} a ${suelta.cliente.razon_social}?\n\nNo se puede borrar después.`)) return;
    conOcupado('suelta', async () => {
      const r = await pedirAlBot('manual', {
        cliente_id: suelta.cliente.id, concepto: suelta.concepto, importe,
        iva_incluido: suelta.iva_incluido, iva_pct: Number(suelta.iva_pct),
      });
      avisar(`Factura ${r.numero} emitida.`);
      setSuelta(null);
      await cargarFacturas();
    });
  }

  function emitirRectificativa() {
    if (!rectificando.motivo.trim()) { avisar('Escribe el motivo de la rectificación.', 'error'); return; }
    const f = rectificando.factura;
    if (!confirm(`¿Emitir una rectificativa que anula la ${f.numero} (${euros(-f.total)})?\n\nNo se puede borrar después.`)) return;
    conOcupado('rectificativa', async () => {
      const r = await pedirAlBot('rectificativa', { factura_id: f.id, motivo: rectificando.motivo });
      avisar(`Rectificativa ${r.numero} emitida.`);
      setRectificando(null);
      await cargarFacturas();
    });
  }

  async function guardarCliente() {
    const d = editando.datos;
    const fallo = errorNif(d.nif);
    if (fallo) { avisar(fallo, 'error'); return; }
    if (!d.restaurante_id || !d.razon_social.trim() || !d.direccion.trim() || !d.fecha_inicio) {
      avisar('Faltan restaurante, razón social, dirección o fecha de la primera factura.', 'error'); return;
    }
    const importe = Number(String(d.importe).replace(',', '.'));
    if (!(importe > 0)) { avisar('El importe tiene que ser mayor que cero.', 'error'); return; }
    const tramos = [];
    for (const t of d.tramos) {
      const periodos = parseInt(t.periodos, 10);
      const imp = Number(String(t.importe).replace(',', '.'));
      if (!(periodos > 0) || !(imp > 0)) { avisar('Cada tramo necesita un número de facturas y un importe mayores que cero.', 'error'); return; }
      tramos.push({ periodos, importe: imp });
    }
    conOcupado('guardar-cliente', async () => {
      const { error } = await supabase.rpc('admin_guardar_cliente_facturacion', {
        p_id: editando.id || null,
        p: {
          ...d, nif: limpiarNif(d.nif), importe, tramos,
          iva_pct: Number(String(d.iva_pct).replace(',', '.')), cada_dias: parseInt(d.cada_dias, 10) || 30,
        },
      });
      if (error) throw new Error(error.message.includes('clientes_facturacion_un_activo')
        ? 'Ese restaurante ya tiene otra ficha de facturación activa.' : error.message);
      avisar('Cliente de facturación guardado.');
      setEditando(null);
      setProximas(null);
      await cargarClientes();
    });
  }

  async function guardarEmisor() {
    const fallo = errorNif(emisor.cif);
    if (fallo) { avisar('CIF del emisor: ' + fallo, 'error'); return; }
    conOcupado('emisor', async () => {
      const { error } = await supabase.rpc('admin_guardar_facturacion_config', { p: emisor });
      if (error) throw new Error(error.message);
      avisar('Datos del emisor guardados. Las facturas ya emitidas no cambian.');
      await cargarEmisor();
    });
  }

  if (cargando) {
    return <div className="min-h-screen flex items-center justify-center bg-bg"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>;
  }

  const seccionActual = SECCIONES.find(s => s.id === seccion);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Receipt className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Facturación</h1>
              <p className="text-xs text-text-muted hidden sm:block">{seccionActual.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/admin" className="btn-ghost">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
            </a>
            <div className="h-6 w-px bg-border mx-1" />
            <MenuNav esAdmin secciones={SECCIONES} seccionActiva={seccion} onSeccion={setSeccion} />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {/* Pestañas también a la vista: son pocas y se cambia mucho entre ellas */}
        <div className="flex gap-1.5 overflow-x-auto">
          {SECCIONES.map(({ id, label, icono: Icono }) => (
            <button key={id} onClick={() => setSeccion(id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                seccion === id ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text hover:bg-surface-2'}`}>
              <Icono className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {mensaje.texto && (
          <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm animate-fade-in ${
            mensaje.tipo === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' : 'bg-accent/10 border-accent/20 text-accent'}`}>
            {mensaje.tipo === 'error' ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{mensaje.texto}</span>
          </div>
        )}

        {faltaEmisor && (
          <div className="flex items-start gap-2 p-3 rounded-lg border text-sm bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>Faltan datos del emisor: hasta completarlos no se puede emitir ninguna factura.{' '}
              <button className="underline font-medium" onClick={() => setSeccion('emisor')}>Completarlos</button></span>
          </div>
        )}

        {/* ================= FACTURAS EMITIDAS ================= */}
        {seccion === 'facturas' && (
          <>
            <div className="card p-4 flex flex-wrap items-end gap-3">
              <div>
                <label className="label">Desde</label>
                <input type="date" className="input" value={filtro.desde} onChange={e => setFiltro({ ...filtro, desde: e.target.value })} />
              </div>
              <div>
                <label className="label">Hasta</label>
                <input type="date" className="input" value={filtro.hasta} onChange={e => setFiltro({ ...filtro, hasta: e.target.value })} />
              </div>
              <div className="min-w-[12rem]">
                <label className="label">Restaurante</label>
                <select className="input" value={filtro.restaurante} onChange={e => setFiltro({ ...filtro, restaurante: e.target.value })}>
                  <option value="">Todos</option>
                  {restaurantes.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              <button className="btn-secondary" onClick={() => conOcupado('filtrar', cargarFacturas)}>
                {ocupado === 'filtrar' && <Loader2 className="w-4 h-4 animate-spin" />}Filtrar
              </button>
              <div className="ml-auto flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-text-muted">
                  <input type="checkbox" checked={soloNuevas} onChange={e => setSoloNuevas(e.target.checked)} />
                  Solo las no exportadas
                </label>
                <button className="btn-primary" onClick={exportarExcel} disabled={ocupado === 'excel'}>
                  {ocupado === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                  Excel para el asesor
                </button>
              </div>
            </div>
            <p className="text-xs text-text-muted -mt-2">
              El Excel usa las fechas de arriba (no el restaurante) y marca las facturas como exportadas.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {[['Facturas', facturas.length], ['Base imponible', euros(totales.base)], ['IVA', euros(totales.cuota)], ['Total', euros(totales.total)]].map(([t, v]) => (
                <div key={t} className="card p-4">
                  <p className="text-xs text-text-muted">{t}</p>
                  <p className="text-lg font-semibold text-text tabular-nums mt-0.5">{v}</p>
                </div>
              ))}
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-text-muted border-b border-border">
                      <th className="px-4 py-3 font-medium">Número</th>
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Concepto</th>
                      <th className="px-4 py-3 font-medium text-right">Total</th>
                      <th className="px-4 py-3 font-medium">Asesor</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.length === 0 && (
                      <tr><td colSpan={7} className="px-4 py-10 text-center text-text-muted">No hay facturas con estos filtros.</td></tr>
                    )}
                    {facturas.map(f => (
                      <tr key={f.id} className="border-b border-border last:border-0 align-top">
                        <td className="px-4 py-3 font-medium text-text whitespace-nowrap tabular-nums">
                          {f.numero}
                          {f.tipo === 'rectificativa' && (
                            <p className="text-xs font-normal text-amber-600 dark:text-amber-400">
                              {f.rectifica_factura_id ? `Rectifica la ${numeroPorId[f.rectifica_factura_id] || '…'}` : 'Rectificativa'}
                            </p>
                          )}
                          {f.sustituida
                            ? <p className="text-xs font-normal text-text-muted">Sustituida · no suma</p>
                            : rectificadas.has(f.id) && <p className="text-xs font-normal text-text-muted">Rectificada</p>}
                        </td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap tabular-nums">{fechaCorta(f.fecha_emision)}</td>
                        <td className="px-4 py-3 text-text">
                          {f.receptor?.razon_social}
                          <p className="text-xs text-text-muted">{nombreRestaurante[f.restaurante_id] || ''}</p>
                        </td>
                        <td className="px-4 py-3 text-text-muted">
                          {f.concepto}
                          <p className="text-xs">{f.origen === 'periodica' ? periodoTexto(f) : f.origen === 'manual' ? 'Factura suelta' : f.origen === 'importada' ? 'Hecha fuera de la web (importada)' : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-text whitespace-nowrap tabular-nums">{euros(f.total)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {exportadas[f.id]
                            ? <span className="badge bg-accent/10 text-accent border border-accent/20">Exportada {fechaCorta(exportadas[f.id])}</span>
                            : <span className="badge bg-surface-2 text-text-muted border border-border">Sin exportar</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button className="btn-ghost text-xs whitespace-nowrap" title="Descargar PDF"
                              onClick={() => conOcupado('pdf-' + f.id, () => descargarPdf(f.id))}>
                              {ocupado === 'pdf-' + f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}PDF
                            </button>
                            {f.tipo === 'ordinaria' && !rectificadas.has(f.id) && (
                              <button className="btn-ghost text-xs whitespace-nowrap" title="Crear una rectificativa que anula esta factura"
                                onClick={() => setRectificando({ factura: f, motivo: '' })}>
                                <Undo2 className="w-3.5 h-3.5" />Rectificar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ================= PRÓXIMAS ================= */}
        {seccion === 'proximas' && (
          <>
            <div className="card p-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-text-muted max-w-2xl">
                Lo que se va a emitir en los próximos 30 días. El proceso se ejecuta solo cada hora desde las 6:00;
                una factura se emite el mismo día en que empieza su periodo.
              </p>
              <button className="btn-secondary" onClick={ejecutarProceso} disabled={ocupado === 'proceso'}>
                {ocupado === 'proceso' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Ejecutar el proceso ahora
              </button>
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-text-muted border-b border-border">
                      <th className="px-4 py-3 font-medium">Fecha</th>
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Periodo</th>
                      <th className="px-4 py-3 font-medium text-right">Importe</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {proximas === null && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-accent inline" /></td></tr>
                    )}
                    {proximas && proximas.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-10 text-center text-text-muted">Nada en los próximos 30 días.</td></tr>
                    )}
                    {(proximas || []).map((p, i) => (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums text-text">
                          {p.error ? '—' : fechaCorta(p.fecha)}
                          {p.atrasada && <span className="ml-2 badge bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Pendiente</span>}
                        </td>
                        <td className="px-4 py-3 text-text">{p.cliente}{p.error && <p className="text-xs text-red-500">{p.error}</p>}</td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap tabular-nums">
                          {p.error ? '' : `${periodoTexto(p)} · nº ${p.numero_periodo}`}
                        </td>
                        <td className="px-4 py-3 text-right text-text whitespace-nowrap tabular-nums">{p.error ? '' : euros(p.importe)}</td>
                        <td className="px-4 py-3 text-right">
                          {p.atrasada && (
                            <button className="btn-ghost text-xs whitespace-nowrap"
                              onClick={() => emitirAhora(clientes.find(c => c.id === p.cliente_id) || { id: p.cliente_id, razon_social: p.cliente })}>
                              <Send className="w-3.5 h-3.5" />Emitir ahora
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ================= CLIENTES ================= */}
        {seccion === 'clientes' && !editando && (
          <>
            <div className="flex justify-end">
              <button className="btn-primary" onClick={() => setEditando({ id: null, datos: { ...CLIENTE_VACIO, fecha_inicio: hoyTexto() } })}>
                <Plus className="w-4 h-4" />Nuevo cliente de facturación
              </button>
            </div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-text-muted border-b border-border">
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Importe</th>
                      <th className="px-4 py-3 font-medium">Cada cuánto</th>
                      <th className="px-4 py-3 font-medium">Primera factura</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-text-muted">Todavía no hay clientes de facturación.</td></tr>
                    )}
                    {clientes.map(c => (
                      <tr key={c.id} className="border-b border-border last:border-0 align-top">
                        <td className="px-4 py-3 text-text">
                          {c.razon_social}
                          <p className="text-xs text-text-muted">{nombreRestaurante[c.restaurante_id] || ''} · {c.nif}</p>
                        </td>
                        <td className="px-4 py-3 text-text whitespace-nowrap tabular-nums">
                          {euros(c.importe)}{c.iva_incluido ? '' : ' + IVA'}
                          {(c.tramos || []).length > 0 && (
                            <p className="text-xs text-text-muted">
                              {c.tramos.map(t => `${t.periodos} a ${euros(t.importe)}`).join(', ')}, después {euros(c.importe)}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                          {c.frecuencia === 'mensual' ? 'Cada mes, mismo día' : `Cada ${c.cada_dias} días`}
                        </td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap tabular-nums">
                          {fechaCorta(c.fecha_inicio)}{c.fecha_fin && <p className="text-xs">Baja: {fechaCorta(c.fecha_fin)}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {c.activo
                            ? <span className="badge bg-accent/10 text-accent border border-accent/20">Activo</span>
                            : <span className="badge bg-surface-2 text-text-muted border border-border">Desactivado</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            <button className="btn-ghost text-xs whitespace-nowrap"
                              onClick={() => setEditando({ id: c.id, datos: {
                                ...CLIENTE_VACIO, ...Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v ?? ''])),
                                importe: String(c.importe), iva_pct: String(c.iva_pct), cada_dias: String(c.cada_dias),
                                tramos: (c.tramos || []).map(t => ({ periodos: String(t.periodos), importe: String(t.importe) })),
                              } })}>
                              <Pencil className="w-3.5 h-3.5" />Editar
                            </button>
                            {c.activo && (
                              <>
                                <button className="btn-ghost text-xs whitespace-nowrap" onClick={() => emitirAhora(c)} disabled={ocupado === 'emitir-' + c.id}>
                                  {ocupado === 'emitir-' + c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}Emitir ahora
                                </button>
                                <button className="btn-ghost text-xs whitespace-nowrap"
                                  onClick={() => setSuelta({ cliente: c, concepto: 'Pedidos por encima del plan', importe: '', iva_incluido: true, iva_pct: String(c.iva_pct) })}>
                                  <Plus className="w-3.5 h-3.5" />Factura suelta
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {seccion === 'clientes' && editando && (
          <FormularioCliente
            editando={editando} setEditando={setEditando} restaurantes={restaurantes}
            guardar={guardarCliente} guardando={ocupado === 'guardar-cliente'} />
        )}

        {/* ================= EMISOR ================= */}
        {seccion === 'emisor' && emisor && (
          <div className="card p-6 space-y-4 max-w-3xl">
            <p className="text-sm text-text-muted">
              Salen en cada factura. Cambiarlos no toca las ya emitidas: cada factura guarda los datos del día en que se hizo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Razón social *" valor={emisor.razon_social} cambiar={v => setEmisor({ ...emisor, razon_social: v })} />
              <Campo label="CIF *" valor={emisor.cif} cambiar={v => setEmisor({ ...emisor, cif: v })} />
              <Campo label="Domicilio *" valor={emisor.domicilio} cambiar={v => setEmisor({ ...emisor, domicilio: v })} />
              <Campo label="Código postal" valor={emisor.cp} cambiar={v => setEmisor({ ...emisor, cp: v })} />
              <Campo label="Ciudad" valor={emisor.ciudad} cambiar={v => setEmisor({ ...emisor, ciudad: v })} />
              <Campo label="Provincia" valor={emisor.provincia} cambiar={v => setEmisor({ ...emisor, provincia: v })} />
              <Campo label="Email" valor={emisor.email} cambiar={v => setEmisor({ ...emisor, email: v })} />
            </div>
            <Campo label="Registro Mercantil *" valor={emisor.registro_mercantil}
              cambiar={v => setEmisor({ ...emisor, registro_mercantil: v })}
              ayuda="Tal cual sale en la factura. Obligatorio en las sociedades limitadas." />
            <div>
              <label className="label">Texto al pie (opcional)</label>
              <textarea className="input" rows="2" value={emisor.pie || ''} onChange={e => setEmisor({ ...emisor, pie: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={guardarEmisor} disabled={ocupado === 'emisor'}>
              {ocupado === 'emisor' && <Loader2 className="w-4 h-4 animate-spin" />}Guardar
            </button>
          </div>
        )}
      </main>

      {/* ---------- Factura suelta ---------- */}
      {suelta && (
        <Ventana titulo={`Factura suelta · ${suelta.cliente.razon_social}`} cerrar={() => setSuelta(null)}>
          <p className="text-sm text-text-muted">Para cobrar algo fuera de la mensualidad, como los pedidos por encima del plan. Lleva la misma numeración.</p>
          <Campo label="Concepto" valor={suelta.concepto} cambiar={v => setSuelta({ ...suelta, concepto: v })} />
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Importe (€)" valor={suelta.importe} cambiar={v => setSuelta({ ...suelta, importe: v })} tipo="text" />
            <Campo label="IVA %" valor={suelta.iva_pct} cambiar={v => setSuelta({ ...suelta, iva_pct: v })} tipo="text" />
          </div>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={suelta.iva_incluido} onChange={e => setSuelta({ ...suelta, iva_incluido: e.target.checked })} />
            El importe ya lleva el IVA incluido
          </label>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setSuelta(null)}>Cancelar</button>
            <button className="btn-primary" onClick={emitirSuelta} disabled={ocupado === 'suelta'}>
              {ocupado === 'suelta' && <Loader2 className="w-4 h-4 animate-spin" />}Emitir factura
            </button>
          </div>
        </Ventana>
      )}

      {/* ---------- Rectificativa ---------- */}
      {rectificando && (
        <Ventana titulo={`Rectificar la ${rectificando.factura.numero}`} cerrar={() => setRectificando(null)}>
          <p className="text-sm text-text-muted">
            Se emite una factura rectificativa (serie R) con los importes en negativo, que anula entera la {rectificando.factura.numero}
            {' '}de {euros(rectificando.factura.total)}. Si hay que volver a facturar bien, se hace después con una factura suelta.
          </p>
          <div>
            <label className="label">Motivo (sale en la factura)</label>
            <textarea className="input" rows="2" value={rectificando.motivo}
              onChange={e => setRectificando({ ...rectificando, motivo: e.target.value })}
              placeholder="Ej: Datos fiscales del cliente incorrectos" />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setRectificando(null)}>Cancelar</button>
            <button className="btn-primary" onClick={emitirRectificativa} disabled={ocupado === 'rectificativa'}>
              {ocupado === 'rectificativa' && <Loader2 className="w-4 h-4 animate-spin" />}Emitir rectificativa
            </button>
          </div>
        </Ventana>
      )}
    </div>
  );
}

function Campo({ label, valor, cambiar, tipo = 'text', ayuda }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={tipo} className="input" value={valor ?? ''} onChange={e => cambiar(e.target.value)} />
      {ayuda && <p className="text-xs text-text-muted mt-1">{ayuda}</p>}
    </div>
  );
}

function Ventana({ titulo, cerrar, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={cerrar}>
      <div className="card p-6 w-full max-w-lg space-y-4 shadow-lift" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-text">{titulo}</h2>
          <button className="btn-ghost p-1.5" onClick={cerrar}><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormularioCliente({ editando, setEditando, restaurantes, guardar, guardando }) {
  const d = editando.datos;
  const cambiar = (campo, v) => setEditando({ ...editando, datos: { ...d, [campo]: v } });
  const nifMal = d.nif ? errorNif(d.nif) : null;
  const cambiarTramo = (i, campo, v) => cambiar('tramos', d.tramos.map((t, j) => (j === i ? { ...t, [campo]: v } : t)));

  return (
    <div className="card p-6 space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-text">{editando.id ? 'Editar cliente de facturación' : 'Nuevo cliente de facturación'}</h2>
        <button className="btn-ghost p-1.5" onClick={() => setEditando(null)}><X className="w-4 h-4" /></button>
      </div>

      <div>
        <label className="label">Restaurante *</label>
        <select className="input" value={d.restaurante_id} onChange={e => cambiar('restaurante_id', e.target.value)}>
          <option value="">Elige el restaurante</option>
          {restaurantes.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="Razón social *" valor={d.razon_social} cambiar={v => cambiar('razon_social', v)} />
        <div>
          <Campo label="NIF / CIF *" valor={d.nif} cambiar={v => cambiar('nif', v)} />
          {nifMal && <p className="text-xs text-red-500 mt-1">{nifMal}</p>}
        </div>
        <Campo label="Dirección *" valor={d.direccion} cambiar={v => cambiar('direccion', v)} />
        <Campo label="Código postal" valor={d.cp} cambiar={v => cambiar('cp', v)} />
        <Campo label="Ciudad" valor={d.ciudad} cambiar={v => cambiar('ciudad', v)} />
        <Campo label="Provincia" valor={d.provincia} cambiar={v => cambiar('provincia', v)} />
      </div>

      <div className="border-t border-border pt-5 space-y-4">
        <Campo label="Concepto" valor={d.concepto} cambiar={v => cambiar('concepto', v)} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Campo label="Importe normal (€) *" valor={d.importe} cambiar={v => cambiar('importe', v)} />
          <Campo label="IVA %" valor={d.iva_pct} cambiar={v => cambiar('iva_pct', v)} />
          <label className="flex items-center gap-2 text-sm text-text sm:mt-7">
            <input type="checkbox" checked={d.iva_incluido} onChange={e => cambiar('iva_incluido', e.target.checked)} />
            IVA incluido
          </label>
        </div>

        {/* Regla de precio propia del cliente */}
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div>
            <p className="text-sm font-medium text-text">Regla de precio (opcional)</p>
            <p className="text-xs text-text-muted">
              Tramos en orden desde la primera factura. Al acabarse, se cobra el importe normal.
              Ej.: 3 facturas a 49 € y después {euros(Number(String(d.importe).replace(',', '.')) || 0)}.
            </p>
          </div>
          {d.tramos.map((t, i) => (
            <div key={i} className="flex items-end gap-2 flex-wrap">
              <div className="w-28">
                <label className="label">Nº de facturas</label>
                <input className="input" value={t.periodos} onChange={e => cambiarTramo(i, 'periodos', e.target.value)} />
              </div>
              <div className="w-32">
                <label className="label">Importe (€)</label>
                <input className="input" value={t.importe} onChange={e => cambiarTramo(i, 'importe', e.target.value)} />
              </div>
              <button className="btn-ghost p-2 hover:text-red-500" title="Quitar tramo"
                onClick={() => cambiar('tramos', d.tramos.filter((_, j) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button className="btn-ghost text-sm" onClick={() => cambiar('tramos', [...d.tramos, { periodos: '3', importe: '49' }])}>
            <Plus className="w-4 h-4" />Añadir tramo
          </button>
        </div>
      </div>

      <div className="border-t border-border pt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label">Cada cuánto se factura</label>
          <select className="input" value={d.frecuencia} onChange={e => cambiar('frecuencia', e.target.value)}>
            <option value="dias">Cada cierto número de días</option>
            <option value="mensual">Cada mes, el mismo día</option>
          </select>
        </div>
        {d.frecuencia === 'dias' && <Campo label="Número de días" valor={d.cada_dias} cambiar={v => cambiar('cada_dias', v)} />}
        <Campo label="Fecha de la primera factura *" tipo="date" valor={d.fecha_inicio} cambiar={v => cambiar('fecha_inicio', v)} />
        <Campo label="Fecha de baja (opcional)" tipo="date" valor={d.fecha_fin} cambiar={v => cambiar('fecha_fin', v)}
          ayuda="A partir de esa fecha no se emite ninguna más." />
      </div>

      <label className="flex items-center gap-2 text-sm text-text">
        <input type="checkbox" checked={d.activo} onChange={e => cambiar('activo', e.target.checked)} />
        Activo (se le factura automáticamente)
      </label>
      <div>
        <label className="label">Notas internas</label>
        <textarea className="input" rows="2" value={d.notas || ''} onChange={e => cambiar('notas', e.target.value)} />
      </div>

      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={() => setEditando(null)}>Cancelar</button>
        <button className="btn-primary" onClick={guardar} disabled={guardando}>
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />}Guardar
        </button>
      </div>
    </div>
  );
}

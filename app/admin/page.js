'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import MenuNav from '@/components/MenuNav';
import BotonTema from '@/components/BotonTema';
import { parsearFechaUTC } from '@/lib/fechas';
import {
  Shield, Loader2, AlertCircle, CheckCircle2,
  Clock, Check, X, Store, Mail, Phone, MapPin, User,
  BarChart3, ShoppingBag, Euro, Users, Cpu, Ban, Activity, Gauge, ArrowUpCircle, LogIn, Briefcase
} from 'lucide-react';
import {
  infoPlan, periodoActual, calcularConsumo, recomendacionUpgrade, ORDEN_PLANES
} from '@/lib/planes';

const DIAS_INACTIVIDAD = 7;

// Las secciones viven en el desplegable, no en una barra de pestanas: con seis
// pestanas la cabecera era todo ruido. "Rechazados" desaparece como seccion y
// pasa a ser un filtro dentro de Restaurantes, que es donde se busca.
const SECCIONES = [
  { id: 'dashboard',    label: 'Dashboard',    icono: BarChart3 },
  { id: 'planes',       label: 'Planes',       icono: Gauge },
  { id: 'pendientes',   label: 'Pendientes',   icono: Clock },
  { id: 'restaurantes', label: 'Restaurantes', icono: Store },
  { id: 'comerciales',  label: 'Comerciales',  icono: Briefcase },
];

export default function PaginaAdmin() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [restaurantes, setRestaurantes] = useState([]);
  const [pestana, setPestana] = useState('dashboard');
  const [procesando, setProcesando] = useState(null);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: 'success' });
  const [statsGlobales, setStatsGlobales] = useState(null);
  const [planesData, setPlanesData] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [editandoPlan, setEditandoPlan] = useState(null); // { id, nombre, plan, inicio }
  const [comerciales, setComerciales] = useState([]);
  const [comercialAbierto, setComercialAbierto] = useState(null);
  const [contactosDe, setContactosDe] = useState({}); // { comercial_id: [contactos] }
  const [verRechazados, setVerRechazados] = useState(false);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: admin } = await supabase.rpc('soy_superadmin');
      if (admin !== true) {
        router.push('/pedidos');
        return;
      }
      await Promise.all([cargarRestaurantes(), cargarStatsGlobales(), cargarPlanes(), cargarComerciales()]);
      setCargando(false);
    }
    init();
  }, []);

  async function cargarPlanes() {
    // Restaurantes aprobados con su plan + ancla de periodo
    const { data: rests } = await supabase
      .from('restaurantes')
      .select('id, nombre, plan, plan_iniciado_en, estado, pedidos_incluidos')
      .eq('estado', 'aprobado');

    // Pedidos de los ultimos 32 dias (cubre el periodo de cualquier restaurante)
    const desde = new Date(Date.now() - 32 * 24 * 60 * 60 * 1000).toISOString();
    const { data: peds } = await supabase
      .from('pedidos')
      .select('restaurante_id, creado_en')
      .gte('creado_en', desde);

    // Solicitudes de upgrade pendientes
    const { data: sols } = await supabase
      .from('solicitudes_upgrade')
      .select('*')
      .eq('estado', 'pendiente')
      .order('solicitado_en', { ascending: true });

    // Agrupar pedidos por restaurante
    const pedidosPorRest = new Map();
    for (const p of (peds || [])) {
      const arr = pedidosPorRest.get(p.restaurante_id) || [];
      arr.push(p.creado_en);
      pedidosPorRest.set(p.restaurante_id, arr);
    }

    // Calcular consumo por restaurante en SU periodo
    const filas = (rests || []).map(r => {
      const per = periodoActual(r.plan_iniciado_en);
      const fechas = pedidosPorRest.get(r.id) || [];
      const pedidosPeriodo = fechas.filter(f => {
        const d = parsearFechaUTC(f);
        return d && d.getTime() >= per.inicio.getTime();
      }).length;
      const consumo = calcularConsumo({
        planId: r.plan,
        pedidosPeriodo,
        diasTranscurridos: per.diasTranscurridos,
        diasTotales: per.diasTotales,
        incluidosOverride: r.pedidos_incluidos,
      });
      const reco = recomendacionUpgrade({ planId: r.plan, proyeccion: consumo.proyeccion });
      return { id: r.id, nombre: r.nombre, plan: r.plan,
               plan_iniciado_en: r.plan_iniciado_en,
               pedidos_incluidos: r.pedidos_incluidos, consumo, reco };
    }).sort((a, b) => b.consumo.porcentaje - a.consumo.porcentaje);

    // Nombres para las solicitudes
    const nombrePorId = new Map((rests || []).map(r => [r.id, r.nombre]));
    const solsConNombre = (sols || []).map(s => ({
      ...s,
      nombreRestaurante: nombrePorId.get(s.restaurante_id) || s.restaurante_id
    }));

    setPlanesData(filas);
    setSolicitudes(solsConNombre);
  }

  async function aprobarUpgrade(sol) {
    setProcesando(sol.id);
    const { error: e1 } = await supabase
      .rpc('cambiar_plan_restaurante', {
        p_restaurante_id: sol.restaurante_id,
        p_plan: sol.plan_solicitado,
      });
    const { error: e2 } = await supabase
      .from('solicitudes_upgrade')
      .update({ estado: 'aprobada', resuelto_en: new Date().toISOString() })
      .eq('id', sol.id);
    setProcesando(null);
    if (e1 || e2) { avisar('Error al aprobar: ' + ((e1 || e2).message), 'error'); return; }
    avisar('Plan de ' + sol.nombreRestaurante + ' cambiado a ' + infoPlan(sol.plan_solicitado).nombre + '.');
    await cargarPlanes();
  }

  async function rechazarUpgrade(sol) {
    setProcesando(sol.id);
    const { error } = await supabase
      .from('solicitudes_upgrade')
      .update({ estado: 'rechazada', resuelto_en: new Date().toISOString() })
      .eq('id', sol.id);
    setProcesando(null);
    if (error) { avisar('Error: ' + error.message, 'error'); return; }
    avisar('Solicitud rechazada.');
    await cargarPlanes();
  }

  // Entrar en el panel de un restaurante para ayudarle. Vincula temporalmente
  // la cuenta de admin a ese restaurante (RPC guardada por soy_superadmin) y
  // a partir de ahi el panel funciona igual que para ellos. Se sale desde el
  // menu, que muestra "Salir del panel" mientras estas dentro.
  async function entrarEnPanel(rest) {
    const ok = window.confirm(
      'Vas a entrar en el panel de "' + (rest.nombre || 'este restaurante') + '".' +
      '\n\nVeras y podras modificar sus datos como si fueras ellos. ' +
      'Para volver aqui, usa "Salir del panel" en el menu.'
    );
    if (!ok) return;
    setProcesando(rest.id);
    const { error } = await supabase.rpc('entrar_en_restaurante', { p_restaurante_id: rest.id });
    setProcesando(null);
    if (error) { avisar('No se pudo entrar: ' + error.message, 'error'); return; }
    router.push('/pedidos');
  }

  // Fecha de un TIMESTAMPTZ para un <input type="date">.
  function aFechaInput(iso) {
    if (!iso) return '';
    const d = parsearFechaUTC(iso);
    const dosDigitos = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + dosDigitos(d.getMonth() + 1) + '-' + dosDigitos(d.getDate());
  }

  function abrirEditorPlan(fila) {
    setEditandoPlan({
      id: fila.id,
      nombre: fila.nombre,
      plan: fila.plan || 'basico',
      inicio: aFechaInput(fila.plan_iniciado_en) || aFechaInput(new Date().toISOString()),
      incluidos: fila.pedidos_incluidos ? String(fila.pedidos_incluidos) : '',
    });
  }

  async function guardarPlan() {
    if (!editandoPlan) return;
    setProcesando(editandoPlan.id);
    const incluidos = editandoPlan.incluidos.trim();
    const { error } = await supabase.rpc('cambiar_plan_restaurante', {
      p_restaurante_id: editandoPlan.id,
      p_plan: editandoPlan.plan,
      // El ancla del periodo: a partir de esta fecha se cuentan los pedidos.
      p_inicio: editandoPlan.inicio
        ? new Date(editandoPlan.inicio + 'T00:00:00').toISOString()
        : null,
      // Vacio = usar los pedidos del plan.
      p_incluidos: incluidos === '' ? null : Number(incluidos),
    });
    setProcesando(null);
    if (error) { avisar('No se pudo guardar: ' + error.message, 'error'); return; }
    avisar('Plan de ' + editandoPlan.nombre + ' actualizado a ' + infoPlan(editandoPlan.plan).nombre + '.');
    setEditandoPlan(null);
    await cargarPlanes();
  }

  async function cargarComerciales() {
    const { data, error } = await supabase.rpc('listar_comerciales_admin');
    if (error) { console.log('Error cargando comerciales:', error); return; }
    setComerciales(data || []);
  }

  // El superadmin SI puede leer los contactos (politica de RLS), asi que
  // aqui se consultan directos.
  async function cargarContactosDe(comercialId) {
    const { data, error } = await supabase
      .from('contactos_comerciales')
      .select('*')
      .eq('comercial_id', comercialId)
      .order('registrado_en', { ascending: false });
    if (error) { avisar('Error cargando sus restaurantes: ' + error.message, 'error'); return; }
    setContactosDe(prev => ({ ...prev, [comercialId]: data || [] }));
  }

  async function verContactos(c) {
    if (comercialAbierto === c.id) { setComercialAbierto(null); return; }
    setComercialAbierto(c.id);
    await cargarContactosDe(c.id);
  }

  async function marcarCerrado(c, contacto) {
    const ok = window.confirm(
      'Marcar "' + contacto.nombre_restaurante + '" como CERRADO?' +
      '\n\nCuenta como venta de ' + c.nombre + ' (90 EUR de comision).'
    );
    if (!ok) return;
    setProcesando(contacto.id);
    const { error } = await supabase.rpc('actualizar_contacto', {
      p_id: contacto.id, p_estado: 'cerrado',
    });
    setProcesando(null);
    if (error) { avisar('Error: ' + error.message, 'error'); return; }
    avisar('Cerrado. Comision de ' + c.nombre + '.');
    await Promise.all([cargarContactosDe(c.id), cargarComerciales()]);
  }

  async function pagarComision(c, contacto, pagada) {
    setProcesando(contacto.id);
    const { error } = await supabase.rpc('marcar_comision', {
      p_id: contacto.id, p_pagada: pagada, p_importe: 90,
    });
    setProcesando(null);
    if (error) { avisar('Error: ' + error.message, 'error'); return; }
    avisar(pagada
      ? 'Comision de ' + contacto.nombre_restaurante + ' marcada como pagada.'
      : 'Marcada como pendiente otra vez.');
    await Promise.all([cargarContactosDe(c.id), cargarComerciales()]);
  }

  async function borrarContactoAdmin(c, contacto) {
    if (!window.confirm('Eliminar "' + contacto.nombre_restaurante + '" de la lista de ' + c.nombre + '?')) return;
    setProcesando(contacto.id);
    const { error } = await supabase.rpc('borrar_contacto', { p_id: contacto.id });
    setProcesando(null);
    if (error) { avisar('Error: ' + error.message, 'error'); return; }
    await Promise.all([cargarContactosDe(c.id), cargarComerciales()]);
  }

  async function cambiarActivoComercial(c, activo) {
    setProcesando(c.id);
    const { error } = await supabase.rpc('activar_comercial', { p_id: c.id, p_activo: activo });
    setProcesando(null);
    if (error) { avisar('Error: ' + error.message, 'error'); return; }
    avisar(activo ? c.nombre + ' aprobado.' : c.nombre + ' desactivado.');
    await cargarComerciales();
  }

  async function cargarRestaurantes() {
    const { data, error } = await supabase.rpc('listar_restaurantes_admin');
    if (error) { console.log('Error:', error); return; }
    setRestaurantes(data || []);
  }

  async function cargarStatsGlobales() {
    // Pedidos globales (sin filtro de restaurante - Supabase RLS para superadmin)
    const ahora = new Date();
    const inicioHoy = new Date(ahora); inicioHoy.setHours(0, 0, 0, 0);
    const inicioSemana = new Date(ahora); inicioSemana.setDate(ahora.getDate() - 7); inicioSemana.setHours(0, 0, 0, 0);
    const inicioMes = new Date(ahora); inicioMes.setDate(ahora.getDate() - 30); inicioMes.setHours(0, 0, 0, 0);
    const limiteInactivos = new Date(ahora); limiteInactivos.setDate(ahora.getDate() - DIAS_INACTIVIDAD);

    const [pedidosResp, restResp, limitsResp] = await Promise.all([
      supabase.from('pedidos')
        .select('id, restaurante_id, creado_en, total, estado')
        .gte('creado_en', inicioMes.toISOString())
        .neq('estado', 'cancelado'),
      supabase.from('restaurantes')
        .select('id, nombre, estado'),
      supabase.from('rate_limits')
        .select('telefono, bloqueado_hasta, motivo_bloqueo, llamadas_ia_dia, contador_dia')
    ]);

    const pedidos = pedidosResp.data || [];
    const todosRestaurantes = restResp.data || [];
    const limits = limitsResp.data || [];

    // Filtrar por estado
    const aprobados = todosRestaurantes.filter(r => r.estado === 'aprobado');

    // Pedidos por restaurante
    const pedidosPorRest = new Map();
    for (const p of pedidos) {
      const prev = pedidosPorRest.get(p.restaurante_id) || { count: 0, ingresos: 0, ultimo: null };
      prev.count++;
      prev.ingresos += Number(p.total || 0);
      const d = parsearFechaUTC(p.creado_en);
      if (d && (!prev.ultimo || d > prev.ultimo)) prev.ultimo = d;
      pedidosPorRest.set(p.restaurante_id, prev);
    }

    // Top 5 restaurantes por pedidos (solo aprobados)
    const top5 = aprobados
      .map(r => ({
        nombre: r.nombre,
        ...(pedidosPorRest.get(r.id) || { count: 0, ingresos: 0, ultimo: null })
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .filter(r => r.count > 0);

    // Inactivos: aprobados sin pedidos en últimos 7 días
    const inactivos = aprobados.filter(r => {
      const d = pedidosPorRest.get(r.id);
      if (!d) return true;
      return !d.ultimo || d.ultimo < limiteInactivos;
    });

    // Filtros temporales
    const pedHoy = pedidos.filter(p => {
      const d = parsearFechaUTC(p.creado_en);
      return d && d >= inicioHoy;
    });
    const pedSemana = pedidos.filter(p => {
      const d = parsearFechaUTC(p.creado_en);
      return d && d >= inicioSemana;
    });

    // Anti-abuso
    const bloqueadosAhora = limits.filter(l => l.bloqueado_hasta && new Date(l.bloqueado_hasta) > ahora);
    const totalLlamadasIA = limits.reduce((s, l) => s + (l.llamadas_ia_dia || 0), 0);
    const totalMensajes = limits.reduce((s, l) => s + (l.contador_dia || 0), 0);

    // Coste IA estimado (Claude Haiku 4.5: ~$0.001 input + ~$0.005 output por 1k tokens
    // promediamos ~$0.003 por llamada típica del bot)
    const costeIAEstimado = totalLlamadasIA * 0.003;

    setStatsGlobales({
      restaurantes: {
        total: todosRestaurantes.length,
        pendientes: todosRestaurantes.filter(r => r.estado === 'pendiente').length,
        aprobados: aprobados.length,
        rechazados: todosRestaurantes.filter(r => r.estado === 'rechazado').length,
        inactivos: inactivos.map(r => r.nombre)
      },
      pedidos: {
        hoy: pedHoy.length,
        semana: pedSemana.length,
        mes: pedidos.length
      },
      ingresos: {
        hoy: pedHoy.reduce((s, p) => s + Number(p.total || 0), 0),
        semana: pedSemana.reduce((s, p) => s + Number(p.total || 0), 0),
        mes: pedidos.reduce((s, p) => s + Number(p.total || 0), 0)
      },
      top5,
      antiAbuso: {
        bloqueadosAhora: bloqueadosAhora.length,
        totalLlamadasIA,
        totalMensajes,
        costeIAEstimado
      }
    });
  }

  function avisar(texto, tipo = 'success') {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: 'success' }), 5000);
  }

  async function aprobar(restId) {
    setProcesando(restId);
    const { error } = await supabase.rpc('aprobar_restaurante', { p_restaurante_id: restId });
    setProcesando(null);
    if (error) { avisar('Error: ' + error.message, 'error'); return; }
    avisar('Restaurante aprobado.');
    await cargarRestaurantes();
  }

  async function rechazar(restId) {
    if (!confirm('¿Rechazar este restaurante? La cuenta no podrá iniciar sesión.')) return;
    setProcesando(restId);
    const { error } = await supabase.rpc('rechazar_restaurante', { p_restaurante_id: restId });
    setProcesando(null);
    if (error) { avisar('Error: ' + error.message, 'error'); return; }
    avisar('Restaurante rechazado.');
    await cargarRestaurantes();
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const pendientes = restaurantes.filter(r => r.estado === 'pendiente');
  const aprobados = restaurantes.filter(r => r.estado === 'aprobado');
  const rechazados = restaurantes.filter(r => r.estado === 'rechazado');

  function listaActual() {
    if (pestana === 'pendientes') return pendientes;
    // Los rechazados no son una seccion propia: apenas se consultan. Viven
    // como un filtro dentro de Restaurantes.
    if (pestana === 'restaurantes') return verRechazados ? rechazados : aprobados;
    return [];
  }

  function badgeEstado(estado) {
    if (estado === 'pendiente') {
      return <span className="badge bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20"><Clock className="w-3 h-3" /> Pendiente</span>;
    }
    if (estado === 'aprobado') {
      return <span className="badge bg-accent/10 text-accent border border-accent/20"><Check className="w-3 h-3" /> Aprobado</span>;
    }
    return <span className="badge bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"><X className="w-3 h-3" /> Rechazado</span>;
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Panel superadmin</h1>
              <p className="text-xs text-text-muted hidden sm:block">Comandi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BotonTema />
            <div className="h-6 w-px bg-border mx-1" />
            <MenuNav
            secciones={SECCIONES.map(sec => ({
              ...sec,
              contador: sec.id === 'planes' ? (solicitudes.length || undefined)
                      : sec.id === 'pendientes' ? (pendientes.length || undefined)
                      : sec.id === 'restaurantes' ? aprobados.length
                      : sec.id === 'comerciales' ? (comerciales.filter(c => !c.activo).length || undefined)
                      : undefined,
            }))}
            seccionActiva={pestana}
            onSeccion={setPestana}
          />
          </div>
        </div>
      </header>


      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {mensaje.texto && (
          <div className={`mb-4 flex items-start gap-2 p-3 rounded-lg border text-sm animate-fade-in ${
            mensaje.tipo === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
              : 'bg-accent/10 border-accent/20 text-accent'
          }`}>
            {mensaje.tipo === 'error' ?
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            }
            <span>{mensaje.texto}</span>
          </div>
        )}

        {pestana === 'dashboard' && <Dashboard stats={statsGlobales} />}

        {pestana === 'planes' && (
          <PlanesPanel
            filas={planesData}
            solicitudes={solicitudes}
            onGestionar={abrirEditorPlan}
            procesando={procesando}
            onAprobar={aprobarUpgrade}
            onRechazar={rechazarUpgrade}
          />
        )}

        {pestana === 'comerciales' && (
          <div className="space-y-6">
            {(() => {
              const pendientes = comerciales.filter(c => !c.activo);
              const activos = comerciales.filter(c => c.activo);
              return (
                <>
                  {pendientes.length > 0 && (
                    <div>
                      <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-accent" />
                        Solicitudes pendientes ({pendientes.length})
                      </h2>
                      <div className="space-y-3">
                        {pendientes.map(c => (
                          <div key={c.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
                            <div className="min-w-0">
                              <p className="font-medium text-text">{c.nombre}</p>
                              <p className="text-sm text-text-muted">
                                {c.email}{c.telefono ? ' · ' + c.telefono : ''}
                              </p>
                              <p className="text-xs text-text-muted mt-0.5">
                                Solicitado el {parsearFechaUTC(c.creado_en).toLocaleDateString('es-ES')}
                              </p>
                            </div>
                            <button
                              onClick={() => cambiarActivoComercial(c, true)}
                              disabled={procesando === c.id}
                              className="btn-primary"
                            >
                              {procesando === c.id
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : <><Check className="w-4 h-4" />Aprobar</>}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h2 className="text-sm font-semibold text-text mb-3">
                      Red comercial ({activos.length})
                    </h2>
                    {activos.length === 0 ? (
                      <div className="card p-12 text-center">
                        <Briefcase className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
                        <p className="text-text-muted">Todavía no hay comerciales activos.</p>
                      </div>
                    ) : (
                      <div className="card overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-border text-text-muted text-left">
                                <th className="px-4 py-3 font-medium">Comercial</th>
                                <th className="px-4 py-3 font-medium">Contacto</th>
                                <th className="px-4 py-3 font-medium text-right">Restaurantes</th>
                                <th className="px-4 py-3 font-medium text-right">Cerrados</th>
                                <th className="px-4 py-3 font-medium text-right">Comisión</th>
                                <th className="px-4 py-3 font-medium"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {activos.flatMap(c => [
                                <tr key={c.id} className="border-b border-border last:border-0">
                                  <td className="px-4 py-3 text-text font-medium">{c.nombre}</td>
                                  <td className="px-4 py-3 text-text-muted">
                                    {c.email}{c.telefono ? <><br />{c.telefono}</> : null}
                                  </td>
                                  <td className="px-4 py-3 text-right tabular-nums text-text-muted">{c.contactos}</td>
                                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-text">{c.cerrados}</td>
                                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                                    {Number(c.comision_pendiente) > 0 ? (
                                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                        {Number(c.comision_pendiente).toFixed(0)}€ pendiente
                                      </span>
                                    ) : (
                                      <span className="text-text-muted">Al día</span>
                                    )}
                                    {Number(c.comision_pagada) > 0 && (
                                      <span className="block text-xs text-text-muted">
                                        {Number(c.comision_pagada).toFixed(0)}€ pagados
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 text-right whitespace-nowrap">
                                    <button
                                      onClick={() => verContactos(c)}
                                      className="btn-ghost text-xs"
                                    >
                                      {comercialAbierto === c.id ? 'Ocultar' : 'Ver restaurantes'}
                                    </button>
                                    <button
                                      onClick={() => cambiarActivoComercial(c, false)}
                                      disabled={procesando === c.id}
                                      className="btn-ghost text-xs"
                                      title="Le quita el acceso, sin borrar su histórico"
                                    >
                                      Desactivar
                                    </button>
                                  </td>
                                </tr>,
                              comercialAbierto === c.id ? (
                                <tr key={c.id + '-detalle'} className="border-b border-border last:border-0 bg-surface-2/40">
                                  <td colSpan="6" className="px-4 py-3">
                                    {(contactosDe[c.id] || []).length === 0 ? (
                                      <p className="text-sm text-text-muted">
                                        Todavía no ha registrado ningún restaurante.
                                      </p>
                                    ) : (
                                      <div className="space-y-2">
                                        {(contactosDe[c.id] || []).map(k => (
                                          <div key={k.id} className="flex items-center justify-between gap-3 flex-wrap">
                                            <div className="min-w-0">
                                              <span className="text-text font-medium">{k.nombre_restaurante}</span>
                                              {k.poblacion ? <span className="text-text-muted"> · {k.poblacion}</span> : null}
                                              {k.telefono ? <span className="text-text-muted"> · {k.telefono}</span> : null}
                                              <span className="text-xs text-text-muted ml-2">
                                                ({k.estado})
                                              </span>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                              {k.estado !== 'cerrado' ? (
                                                <button
                                                  onClick={() => marcarCerrado(c, k)}
                                                  disabled={procesando === k.id}
                                                  className="btn-ghost text-xs"
                                                  title="Cuenta como venta suya"
                                                >
                                                  <Check className="w-3.5 h-3.5" />
                                                  Marcar cerrado
                                                </button>
                                              ) : k.comision_pagada_en ? (
                                                <button
                                                  onClick={() => pagarComision(c, k, false)}
                                                  disabled={procesando === k.id}
                                                  className="btn-ghost text-xs text-accent"
                                                  title={'Pagada el ' + parsearFechaUTC(k.comision_pagada_en).toLocaleDateString('es-ES') + '. Pulsa para deshacer.'}
                                                >
                                                  <Euro className="w-3.5 h-3.5" />
                                                  Comisión pagada
                                                </button>
                                              ) : (
                                                <button
                                                  onClick={() => pagarComision(c, k, true)}
                                                  disabled={procesando === k.id}
                                                  className="btn-secondary text-xs"
                                                >
                                                  <Euro className="w-3.5 h-3.5" />
                                                  Marcar comisión pagada
                                                </button>
                                              )}
                                              <button
                                                onClick={() => borrarContactoAdmin(c, k)}
                                                disabled={procesando === k.id}
                                                className="btn-ghost text-xs text-red-500 hover:text-red-600"
                                              >
                                                Eliminar
                                              </button>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ) : null,
                              ])}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-text-muted mt-3">
                      Cuando un restaurante firme y pague, ábrelo con &laquo;Ver restaurantes&raquo;
                      y márcalo como cerrado: ahí es cuando cuenta como venta suya.
                      La comisión es orientativa: 90 € por restaurante cerrado. No refleja
                      lo que ya hayas pagado.
                    </p>
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {pestana === 'restaurantes' && (
          <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-text-muted">
              {verRechazados
                ? rechazados.length + (rechazados.length === 1 ? ' restaurante rechazado' : ' restaurantes rechazados')
                : aprobados.length + (aprobados.length === 1 ? ' restaurante activo' : ' restaurantes activos')}
            </p>
            <div className="flex gap-1 p-1 rounded-lg bg-surface-2">
              <button
                onClick={() => setVerRechazados(false)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  !verRechazados ? 'bg-surface text-text shadow-card' : 'text-text-muted hover:text-text'
                }`}
              >
                Activos
              </button>
              <button
                onClick={() => setVerRechazados(true)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  verRechazados ? 'bg-surface text-text shadow-card' : 'text-text-muted hover:text-text'
                }`}
              >
                Rechazados{rechazados.length ? ' (' + rechazados.length + ')' : ''}
              </button>
            </div>
          </div>
        )}

        {(pestana === 'pendientes' || pestana === 'restaurantes') && (
          listaActual().length === 0 ? (
            <div className="card p-12 text-center">
              <Store className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
              <p className="text-text-muted">
                {pestana === 'pendientes'
                  ? 'No hay solicitudes pendientes.'
                  : verRechazados ? 'No has rechazado ninguno.' : 'Todavía no hay restaurantes activos.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {listaActual().map(r => (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-base font-semibold text-text">{r.nombre || 'Sin nombre'}</h3>
                        {badgeEstado(r.estado)}
                      </div>
                      {r.descripcion && (
                        <p className="text-sm text-text-muted mb-3">{r.descripcion}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {r.email_contacto && (
                      <div className="flex items-center gap-2 text-text-muted">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{r.email_contacto}</span>
                      </div>
                    )}
                    {r.telefono && (
                      <div className="flex items-center gap-2 text-text-muted">
                        <Phone className="w-4 h-4 flex-shrink-0" />
                        <span>{r.telefono}</span>
                      </div>
                    )}
                    {r.direccion && (
                      <div className="flex items-center gap-2 text-text-muted">
                        <MapPin className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{r.direccion}</span>
                      </div>
                    )}
                    {r.email_usuario && (
                      <div className="flex items-center gap-2 text-text-muted">
                        <User className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{r.email_usuario}</span>
                      </div>
                    )}
                  </div>

                  {/* Su plan y consumo, cruzado con lo que ya calcula la
                      seccion de Planes. Asi esta ficha sirve de directorio. */}
                  {(() => {
                    const p = (planesData || []).find(x => x.id === r.id);
                    if (!p) return null;
                    return (
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-sm flex-wrap">
                        <span className="text-text-muted">
                          Plan <strong className="text-text">{infoPlan(p.plan).nombre}</strong>
                        </span>
                        <span className="text-text-muted tabular-nums">
                          {p.consumo.consumidos}/{p.consumo.incluidos} pedidos
                        </span>
                        {p.consumo.overageCoste > 0 && (
                          <span className="text-red-500 tabular-nums">
                            +{p.consumo.overageCoste.toFixed(2)}€ de exceso
                          </span>
                        )}
                        {p.plan_iniciado_en && (
                          <span className="text-text-muted text-xs">
                            Desde el {parsearFechaUTC(p.plan_iniciado_en).toLocaleDateString('es-ES')}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => entrarEnPanel(r)}
                      disabled={procesando === r.id}
                      className="btn-secondary text-sm"
                      title="Ver y gestionar su panel para ayudarles"
                    >
                      <LogIn className="w-4 h-4" />
                      Entrar en su panel
                    </button>
                  </div>

                  {r.estado === 'pendiente' && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() => aprobar(r.id)}
                        disabled={procesando === r.id}
                        className="btn-primary flex-1"
                      >
                        {procesando === r.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="w-4 h-4" />
                            Aprobar
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => rechazar(r.id)}
                        disabled={procesando === r.id}
                        className="btn-danger flex-1"
                      >
                        <X className="w-4 h-4" />
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}

        {/* Cambiar el plan de un restaurante */}
        {editandoPlan && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in"
            style={{ background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setEditandoPlan(null)}
          >
            <div className="card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 mb-1">
                <h3 className="text-lg font-semibold text-text">Plan de {editandoPlan.nombre}</h3>
                <button onClick={() => setEditandoPlan(null)} className="text-text-muted hover:text-text">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-text-muted mb-5">
                El cobro todavia es manual. Esto fija lo que cuenta el sistema: pedidos
                incluidos, exceso y avisos de consumo.
              </p>

              <label className="label">Plan contratado</label>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {ORDEN_PLANES.map(id => {
                  const p = infoPlan(id);
                  const activo = editandoPlan.plan === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setEditandoPlan({ ...editandoPlan, plan: id })}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        activo
                          ? 'bg-accent/10 border-accent text-text'
                          : 'bg-surface-2 border-border text-text-muted hover:border-accent/40'
                      }`}
                    >
                      <span className="block text-sm font-semibold">{p.nombre}</span>
                      <span className="block text-xs mt-0.5 tabular-nums">{p.precio}&euro;/mes + IVA</span>
                      <span className="block text-xs text-text-muted mt-0.5 tabular-nums">
                        {p.pedidosIncluidos} pedidos
                      </span>
                    </button>
                  );
                })}
              </div>

              <label className="label">Fecha de alta</label>
              <input
                type="date"
                value={editandoPlan.inicio}
                onChange={(e) => setEditandoPlan({ ...editandoPlan, inicio: e.target.value })}
                className="input"
              />
              <p className="text-xs text-text-muted mt-1.5 mb-5">
                Marca el dia de cada mes en que empieza el periodo. Si la cambias, el
                contador de pedidos del periodo actual se recalcula.
              </p>

              <label className="label">Pedidos incluidos</label>
              <input
                type="number"
                min="1"
                value={editandoPlan.incluidos}
                onChange={(e) => setEditandoPlan({ ...editandoPlan, incluidos: e.target.value })}
                placeholder={String(infoPlan(editandoPlan.plan).pedidosIncluidos) + ' (los del plan)'}
                className="input"
              />
              <p className="text-xs text-text-muted mt-1.5 mb-5">
                Dejalo vacio para usar los del plan. Ponlo solo si has pactado otra
                cantidad con este restaurante: manda sobre el plan en su panel y en
                los avisos de consumo.
              </p>

              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditandoPlan(null)} className="btn-ghost">Cancelar</button>
                <button
                  onClick={guardarPlan}
                  disabled={procesando === editandoPlan.id}
                  className="btn-primary"
                >
                  {procesando === editandoPlan.id
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Check className="w-4 h-4" />Guardar</>}
                </button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}

// ============== PANEL DE PLANES Y CONSUMO ==============

function PlanesPanel({ filas, solicitudes, procesando, onAprobar, onRechazar, onGestionar }) {
  if (!filas) {
    return (
      <div className="card p-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Solicitudes de upgrade pendientes */}
      {solicitudes.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-text mb-3 flex items-center gap-2">
            <ArrowUpCircle className="w-4 h-4 text-accent" />
            Solicitudes de cambio de plan ({solicitudes.length})
          </h2>
          <div className="space-y-3">
            {solicitudes.map(s => (
              <div key={s.id} className="card p-4 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="font-medium text-text">{s.nombreRestaurante}</p>
                  <p className="text-sm text-text-muted">
                    {infoPlan(s.plan_actual).nombre} → <strong className="text-text">{infoPlan(s.plan_solicitado).nombre}</strong>
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => onAprobar(s)} disabled={procesando === s.id} className="btn-primary">
                    {procesando === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Aprobar</>}
                  </button>
                  <button onClick={() => onRechazar(s)} disabled={procesando === s.id} className="btn-danger">
                    <X className="w-4 h-4" />Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabla de consumo por restaurante */}
      <div>
        <h2 className="text-sm font-semibold text-text mb-3">Consumo por restaurante (periodo actual)</h2>
        {filas.length === 0 ? (
          <div className="card p-12 text-center">
            <Gauge className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
            <p className="text-text-muted">No hay restaurantes aprobados todavía.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted text-left">
                    <th className="px-4 py-3 font-medium">Restaurante</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Consumo</th>
                    <th className="px-4 py-3 font-medium">Proyección</th>
                    <th className="px-4 py-3 font-medium">Overage</th>
                    <th className="px-4 py-3 font-medium">Desde</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map(f => {
                    const c = f.consumo;
                    const colorTexto =
                      c.nivelAviso === 'exceso' || c.nivelAviso === 'limite' ? 'text-red-500'
                      : c.nivelAviso === 'aviso' ? 'text-yellow-600 dark:text-yellow-400' : 'text-text';
                    return (
                      <tr key={f.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 text-text font-medium">{f.nombre}</td>
                        <td className="px-4 py-3 text-text-muted">{infoPlan(f.plan).nombre}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`tabular-nums font-medium ${colorTexto}`}>
                              {c.consumidos}/{c.incluidos}
                            </span>
                            <span className="text-xs text-text-muted tabular-nums">
                              ({Math.round(c.porcentaje * 100)}%)
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-text-muted tabular-nums">~{c.proyeccion}</td>
                        <td className="px-4 py-3 tabular-nums">
                          {c.overageCoste > 0
                            ? <span className="text-red-500">+{c.overageCoste.toFixed(2)}€</span>
                            : <span className="text-text-muted">—</span>}
                        </td>
                        <td className="px-4 py-3 text-text-muted whitespace-nowrap">
                          {f.plan_iniciado_en
                            ? parsearFechaUTC(f.plan_iniciado_en).toLocaleDateString('es-ES')
                            : <span className="text-yellow-600 dark:text-yellow-400">Sin fijar</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 justify-end">
                            {f.reco && f.reco.recomendar && (
                              <span className="badge bg-accent/10 text-accent border border-accent/20 whitespace-nowrap">
                                <ArrowUpCircle className="w-3 h-3" /> Sugerir {infoPlan(f.reco.siguienteId).nombre}
                              </span>
                            )}
                            <button
                              onClick={() => onGestionar(f)}
                              className="btn-ghost text-xs whitespace-nowrap"
                              title="Cambiar de plan o ajustar la fecha de alta"
                            >
                              <Gauge className="w-3.5 h-3.5" />
                              Gestionar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============== DASHBOARD GLOBAL ==============

function Dashboard({ stats }) {
  if (!stats) {
    return (
      <div className="card p-12 text-center">
        <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Restaurantes */}
      <section>
        <h2 className="text-lg font-semibold text-text mb-3">Restaurantes</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CardStat icon={Store} label="Aprobados activos" value={stats.restaurantes.aprobados} accent />
          <CardStat icon={Clock} label="Pendientes" value={stats.restaurantes.pendientes} />
          <CardStat icon={X} label="Rechazados" value={stats.restaurantes.rechazados} />
          <CardStat icon={Ban} label={`Inactivos (${DIAS_INACTIVIDAD}d)`} value={stats.restaurantes.inactivos.length} alerta={stats.restaurantes.inactivos.length > 0} />
        </div>
        {stats.restaurantes.inactivos.length > 0 && (
          <p className="text-xs text-text-muted mt-2">
            Inactivos: {stats.restaurantes.inactivos.join(', ')}
          </p>
        )}
      </section>

      {/* Pedidos */}
      <section>
        <h2 className="text-lg font-semibold text-text mb-3">Pedidos en plataforma</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <CardStat icon={ShoppingBag} label="Hoy" value={stats.pedidos.hoy} sub={stats.ingresos.hoy.toFixed(2) + ' €'} accent />
          <CardStat icon={ShoppingBag} label="Últimos 7 días" value={stats.pedidos.semana} sub={stats.ingresos.semana.toFixed(2) + ' €'} />
          <CardStat icon={ShoppingBag} label="Últimos 30 días" value={stats.pedidos.mes} sub={stats.ingresos.mes.toFixed(2) + ' €'} />
        </div>
      </section>

      {/* Top 5 restaurantes */}
      {stats.top5.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text mb-3">Top 5 restaurantes (últimos 30 días)</h2>
          <div className="card p-5">
            <div className="space-y-2">
              {stats.top5.map((r, i) => (
                <div key={r.nombre} className="flex items-center gap-3">
                  <span className="text-xs font-bold w-5 text-right text-text-muted tabular-nums">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text truncate">{r.nombre}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-text tabular-nums">{r.count}</p>
                    <p className="text-xs text-text-muted">{r.ingresos.toFixed(2)} €</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Anti-abuso & Coste */}
      <section>
        <h2 className="text-lg font-semibold text-text mb-3">Anti-abuso y consumo</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <CardStat icon={Ban} label="Bloqueados ahora" value={stats.antiAbuso.bloqueadosAhora} alerta={stats.antiAbuso.bloqueadosAhora > 0} />
          <CardStat icon={Activity} label="Mensajes hoy" value={stats.antiAbuso.totalMensajes} />
          <CardStat icon={Cpu} label="Llamadas IA hoy" value={stats.antiAbuso.totalLlamadasIA} />
          <CardStat icon={Euro} label="Coste IA hoy aprox" value={'~' + stats.antiAbuso.costeIAEstimado.toFixed(3) + ' €'} sub="Claude Haiku 4.5" />
        </div>
      </section>

      {/* Links externos */}
      <section>
        <h2 className="text-lg font-semibold text-text mb-3">Enlaces externos</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <a href="https://sentry.io" target="_blank" rel="noreferrer" className="card p-4 hover:border-accent/30 transition-colors">
            <p className="text-sm font-semibold text-text">Sentry</p>
            <p className="text-xs text-text-muted">Errores en runtime →</p>
          </a>
          <a href="https://uptimerobot.com/dashboard" target="_blank" rel="noreferrer" className="card p-4 hover:border-accent/30 transition-colors">
            <p className="text-sm font-semibold text-text">UptimeRobot</p>
            <p className="text-xs text-text-muted">Disponibilidad servicios →</p>
          </a>
          <a href="https://railway.app" target="_blank" rel="noreferrer" className="card p-4 hover:border-accent/30 transition-colors">
            <p className="text-sm font-semibold text-text">Railway</p>
            <p className="text-xs text-text-muted">Logs del bot →</p>
          </a>
          <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="card p-4 hover:border-accent/30 transition-colors">
            <p className="text-sm font-semibold text-text">Supabase</p>
            <p className="text-xs text-text-muted">BD y auth →</p>
          </a>
        </div>
      </section>
    </div>
  );
}

function CardStat({ icon: Icon, label, value, sub, accent, alerta }) {
  return (
    <div className={`card p-4 ${alerta ? 'border-red-500/40' : ''}`}>
      <div className="flex items-center gap-2 mb-2 text-text-muted">
        <Icon className={`w-4 h-4 ${alerta ? 'text-red-500' : accent ? 'text-accent' : ''}`} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${alerta ? 'text-red-500' : 'text-text'}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import { parsearFechaUTC } from '@/lib/fechas';
import {
  ArrowLeft, Shield, Loader2, AlertCircle, CheckCircle2,
  Clock, Check, X, Store, Mail, Phone, MapPin, User,
  BarChart3, ShoppingBag, Euro, Users, Cpu, Ban, Activity
} from 'lucide-react';

const DIAS_INACTIVIDAD = 7;

export default function PaginaAdmin() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [restaurantes, setRestaurantes] = useState([]);
  const [pestana, setPestana] = useState('dashboard');
  const [procesando, setProcesando] = useState(null);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: 'success' });
  const [statsGlobales, setStatsGlobales] = useState(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: admin } = await supabase.rpc('soy_superadmin');
      if (admin !== true) {
        router.push('/pedidos');
        return;
      }
      await Promise.all([cargarRestaurantes(), cargarStatsGlobales()]);
      setCargando(false);
    }
    init();
  }, []);

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
    if (pestana === 'aprobados') return aprobados;
    if (pestana === 'rechazados') return rechazados;
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
          <a href="/pedidos" className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </a>
        </div>
      </header>

      {/* Pestañas */}
      <div className="border-b border-border bg-bg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-1 overflow-x-auto">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'pendientes', label: 'Pendientes', count: pendientes.length, icon: Clock },
            { id: 'aprobados', label: 'Aprobados', count: aprobados.length, icon: Check },
            { id: 'rechazados', label: 'Rechazados', count: rechazados.length, icon: X },
          ].map(t => {
            const Icono = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setPestana(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  pestana === t.id
                    ? 'border-accent text-text'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                <Icono className="w-4 h-4" />
                {t.label}
                {t.count !== undefined && (
                  <span className="tabular-nums text-xs px-1.5 py-0.5 rounded-md bg-surface-2 text-text-muted">
                    {t.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

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

        {pestana !== 'dashboard' && (
          listaActual().length === 0 ? (
            <div className="card p-12 text-center">
              <Store className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
              <p className="text-text-muted">
                No hay restaurantes {pestana === 'pendientes' ? 'pendientes' : pestana === 'aprobados' ? 'aprobados' : 'rechazados'}.
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
      </main>
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

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import MenuNav from '@/components/MenuNav';
import { parsearFechaUTC } from '@/lib/fechas';
import {
  BarChart3, ArrowLeft, Loader2, TrendingUp, TrendingDown,
  ShoppingBag, Euro, Clock, Store, Home, Users, Flame, Calendar,
  Download, Star
} from 'lucide-react';

const ACCENT = 'rgb(16, 185, 129)';
const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function PaginaAnaliticas() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [restaurante, setRestaurante] = useState(null);
  const [rango, setRango] = useState(30); // días
  const [stats, setStats] = useState(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (restId) {
        const { data: rest } = await supabase
          .from('restaurantes').select('id, nombre').eq('id', restId).maybeSingle();
        if (rest) setRestaurante(rest);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!restaurante) return;
    cargarStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurante, rango]);

  async function cargarStats() {
    setCargando(true);

    // Fecha de inicio del periodo actual y del anterior (mismo tamaño).
    const ahora = new Date();
    const desde = new Date(ahora);
    desde.setDate(desde.getDate() - rango);
    desde.setHours(0, 0, 0, 0);
    const desdeAnterior = new Date(ahora);
    desdeAnterior.setDate(desdeAnterior.getDate() - rango * 2);
    desdeAnterior.setHours(0, 0, 0, 0);

    // Traemos pedidos de los DOS periodos (actual + anterior) en una query y
    // los separamos en JS. Sirve para comparar tendencia.
    const { data: pedidosTodos } = await supabase
      .from('pedidos')
      .select('id, total, creado_en, entregado_en, estado, tipo_entrega, metodo_pago, cliente_telefono')
      .eq('restaurante_id', restaurante.id)
      .gte('creado_en', desdeAnterior.toISOString())
      .neq('estado', 'cancelado');

    const todos = pedidosTodos || [];
    const desdeMs = desde.getTime();
    const actuales = [];
    const anteriores = [];
    for (const p of todos) {
      const d = parsearFechaUTC(p.creado_en);
      if (!d) continue;
      if (d.getTime() >= desdeMs) actuales.push(p);
      else anteriores.push(p);
    }

    if (actuales.length === 0) {
      setStats({ vacio: true });
      setCargando(false);
      return;
    }

    // Líneas para top productos (solo periodo actual)
    const ids = actuales.map(p => p.id);
    const { data: lineas } = await supabase
      .from('lineas_pedido').select('*').in('pedido_id', ids);

    // Reseñas del periodo actual (valoración media). Defensivo: si falla, 0.
    let resenas = [];
    try {
      const { data: r } = await supabase
        .from('resenas')
        .select('puntuacion, creado_en')
        .eq('restaurante_id', restaurante.id)
        .gte('creado_en', desde.toISOString());
      resenas = r || [];
    } catch (e) { resenas = []; }

    setStats(calcularStats(actuales, lineas || [], rango, anteriores, resenas));
    setCargando(false);
  }

  if (cargando || !restaurante) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-accent" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-base font-bold text-text">Analíticas</h1>
              <p className="text-xs text-text-muted">{restaurante.nombre}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {stats && !stats.vacio && (
              <button
                onClick={() => exportarCSV(stats, rango, restaurante.nombre)}
                className="btn-secondary"
                title="Descargar analíticas en CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar</span>
              </button>
            )}
            <a href="/pedidos" className="btn-ghost">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </a>
            <div className="h-6 w-px bg-border mx-1" />
            <MenuNav />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
        {/* Selector de rango */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-text tabular-nums">
              Datos de los últimos {rango} días
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Pedidos completados · comparado con los {rango} días anteriores
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg bg-border/30">
            {[7, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setRango(d)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  rango === d
                    ? 'bg-bg text-text shadow-sm'
                    : 'text-text-muted hover:text-text'
                }`}
              >
                {d} días
              </button>
            ))}
          </div>
        </div>

        {stats?.vacio ? (
          <div className="card p-12 text-center">
            <BarChart3 className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
            <p className="text-lg text-text font-medium mb-2">Sin datos en este rango</p>
            <p className="text-sm text-text-muted">
              Cuando recibas pedidos, aparecerán aquí las analíticas.
            </p>
          </div>
        ) : (
          <>
            <SeccionResumen stats={stats} />
            <SeccionGraficos stats={stats} />
            <SeccionTopProductos stats={stats} />
            <SeccionInsights stats={stats} />
          </>
        )}
      </main>
    </div>
  );
}

// ============== CÁLCULO DE STATS ==============

function calcularStats(pedidos, lineas, diasRango, pedidosAnterior, resenas) {
  // Resumen
  const totalPedidos = pedidos.length;
  const ingresosTotales = pedidos.reduce((s, p) => s + Number(p.total || 0), 0);
  const ticketMedio = ingresosTotales / totalPedidos;
  const recogida = pedidos.filter(p => p.tipo_entrega === 'recogida').length;
  const domicilio = pedidos.filter(p => p.tipo_entrega === 'domicilio').length;
  const pctRecogida = totalPedidos > 0 ? Math.round((recogida / totalPedidos) * 100) : 0;

  // Por método de pago
  const efectivo = pedidos.filter(p => p.metodo_pago === 'efectivo').length;
  const tarjeta = pedidos.filter(p => p.metodo_pago === 'tarjeta').length;
  const pagoLocal = pedidos.filter(p => p.metodo_pago === 'pago_en_local').length;

  // Clientes únicos del periodo
  const telefonosMap = new Map();
  for (const p of pedidos) {
    const tel = p.cliente_telefono;
    if (!tel) continue;
    telefonosMap.set(tel, (telefonosMap.get(tel) || 0) + 1);
  }
  const totalClientesUnicos = telefonosMap.size;
  const recurrentes = Array.from(telefonosMap.values()).filter(c => c > 1).length;
  const pctRecurrentes = totalClientesUnicos > 0
    ? Math.round((recurrentes / totalClientesUnicos) * 100)
    : 0;

  // ===== Tendencia vs periodo anterior =====
  const prevPedidos = pedidosAnterior.length;
  const prevIngresos = pedidosAnterior.reduce((s, p) => s + Number(p.total || 0), 0);
  const prevTicket = prevPedidos > 0 ? prevIngresos / prevPedidos : 0;
  const prevClientes = new Set(pedidosAnterior.map(p => p.cliente_telefono).filter(Boolean)).size;
  // delta porcentual; null si no hay base de comparación
  const delta = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);
  const tendencia = {
    pedidos: delta(totalPedidos, prevPedidos),
    ingresos: delta(ingresosTotales, prevIngresos),
    ticket: delta(ticketMedio, prevTicket),
    clientes: delta(totalClientesUnicos, prevClientes),
  };

  // Top productos (por unidades y por facturación)
  const productosMap = new Map();
  for (const l of lineas) {
    const nombre = l.nombre_producto || 'Producto sin nombre';
    const prev = productosMap.get(nombre) || { unidades: 0, ingresos: 0, pedidos: 0 };
    prev.unidades += Number(l.cantidad || 0);
    prev.ingresos += Number(l.cantidad || 0) * Number(l.precio_unitario ?? l.precio ?? 0);
    prev.pedidos += 1;
    productosMap.set(nombre, prev);
  }
  const productos = Array.from(productosMap.entries())
    .map(([nombre, d]) => ({ nombre, ...d }));

  const topProductos = [...productos].sort((a, b) => b.unidades - a.unidades).slice(0, 10);
  const topProductosIngresos = [...productos].sort((a, b) => b.ingresos - a.ingresos).slice(0, 10);
  const peoresProductos = [...productos].sort((a, b) => a.unidades - b.unidades).slice(0, 5);

  // Pedidos e ingresos por día
  const porDia = new Map();
  const ingDia = new Map();
  for (let i = 0; i < diasRango; i++) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const clave = d.toISOString().slice(0, 10);
    porDia.set(clave, 0);
    ingDia.set(clave, 0);
  }
  for (const p of pedidos) {
    const d = parsearFechaUTC(p.creado_en);
    if (!d) continue;
    const clave = new Date(d.getFullYear(), d.getMonth(), d.getDate())
      .toISOString().slice(0, 10);
    if (porDia.has(clave)) {
      porDia.set(clave, porDia.get(clave) + 1);
      ingDia.set(clave, ingDia.get(clave) + Number(p.total || 0));
    }
  }
  const pedidosPorDia = Array.from(porDia.entries())
    .map(([fecha, count]) => ({ fecha, count, ingresos: ingDia.get(fecha) || 0 }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  // Pedidos por hora del día
  const porHora = new Array(24).fill(0);
  for (const p of pedidos) {
    const d = parsearFechaUTC(p.creado_en);
    if (!d) continue;
    porHora[d.getHours()]++;
  }

  // Pedidos por día de la semana (0 = domingo)
  const porDiaSemana = new Array(7).fill(0);
  for (const p of pedidos) {
    const d = parsearFechaUTC(p.creado_en);
    if (!d) continue;
    porDiaSemana[d.getDay()]++;
  }

  // Insights
  const horaPico = porHora.indexOf(Math.max(...porHora));
  const diaPico = porDiaSemana.indexOf(Math.max(...porDiaSemana));

  // Tiempo medio de preparación (en minutos)
  const entregados = pedidos.filter(p => p.entregado_en && p.creado_en);
  let tiempoMedioPrep = null;
  if (entregados.length > 0) {
    const totalMin = entregados.reduce((s, p) => {
      const dc = parsearFechaUTC(p.creado_en);
      const de = parsearFechaUTC(p.entregado_en);
      if (!dc || !de) return s;
      return s + (de.getTime() - dc.getTime()) / 60000;
    }, 0);
    tiempoMedioPrep = Math.round(totalMin / entregados.length);
  }

  // Valoración media (reseñas del periodo)
  const numResenas = (resenas || []).length;
  const valoracionMedia = numResenas > 0
    ? Math.round((resenas.reduce((s, r) => s + Number(r.puntuacion || 0), 0) / numResenas) * 10) / 10
    : null;

  return {
    totalPedidos, ingresosTotales, ticketMedio,
    recogida, domicilio, pctRecogida,
    efectivo, tarjeta, pagoLocal,
    topProductos, topProductosIngresos, peoresProductos,
    pedidosPorDia, porHora, porDiaSemana,
    horaPico, diaPico,
    tiempoMedioPrep,
    totalClientesUnicos, recurrentes, pctRecurrentes,
    tendencia,
    valoracionMedia, numResenas,
  };
}

// ============== EXPORTAR CSV ==============

function exportarCSV(stats, rango, nombreRest) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lineas = [];
  lineas.push('Analiticas - ' + (nombreRest || '') + ' - ultimos ' + rango + ' dias');
  lineas.push('');
  lineas.push('Resumen;Valor');
  lineas.push('Pedidos;' + stats.totalPedidos);
  lineas.push('Ingresos (EUR);' + stats.ingresosTotales.toFixed(2));
  lineas.push('Ticket medio (EUR);' + stats.ticketMedio.toFixed(2));
  lineas.push('Clientes unicos;' + stats.totalClientesUnicos);
  lineas.push('% recurrentes;' + stats.pctRecurrentes);
  if (stats.valoracionMedia !== null) lineas.push('Valoracion media;' + stats.valoracionMedia + ' (' + stats.numResenas + ' resenas)');
  if (stats.tiempoMedioPrep !== null) lineas.push('Tiempo medio preparacion (min);' + stats.tiempoMedioPrep);
  lineas.push('');
  lineas.push('Fecha;Pedidos;Ingresos (EUR)');
  for (const d of stats.pedidosPorDia) {
    lineas.push(esc(d.fecha) + ';' + d.count + ';' + Number(d.ingresos).toFixed(2));
  }
  lineas.push('');
  lineas.push('Top productos (unidades);Unidades;Ingresos (EUR)');
  for (const p of stats.topProductos) {
    lineas.push(esc(p.nombre) + ';' + p.unidades + ';' + Number(p.ingresos).toFixed(2));
  }

  const csv = '﻿' + lineas.join('\n'); // BOM para que Excel respete acentos
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'analiticas-' + rango + 'dias.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============== COMPONENTES UI ==============

function SeccionResumen({ stats }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-10">
      <StatCard
        icon={ShoppingBag}
        label="Pedidos"
        value={stats.totalPedidos}
        sub={`${stats.recogida} recogida · ${stats.domicilio} domicilio`}
        delta={stats.tendencia.pedidos}
      />
      <StatCard
        icon={Euro}
        label="Ingresos"
        value={stats.ingresosTotales.toFixed(2) + ' €'}
        sub="Bruto (incluye IVA si aplica)"
        delta={stats.tendencia.ingresos}
      />
      <StatCard
        icon={TrendingUp}
        label="Ticket medio"
        value={stats.ticketMedio.toFixed(2) + ' €'}
        sub="Por pedido"
        delta={stats.tendencia.ticket}
      />
      <StatCard
        icon={Users}
        label="Clientes únicos"
        value={stats.totalClientesUnicos}
        sub={`${stats.pctRecurrentes}% recurrentes`}
        delta={stats.tendencia.clientes}
      />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, delta }) {
  // delta: número (% cambio vs periodo anterior) o null
  const hayDelta = delta !== null && delta !== undefined && Number.isFinite(delta);
  const sube = hayDelta && delta >= 0;
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 text-text-muted">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        {hayDelta && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
            sube ? 'text-accent' : 'text-red-500'
          }`} title="vs periodo anterior">
            {sube ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {sube ? '+' : ''}{delta}%
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold text-text tabular-nums">{value}</p>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
    </div>
  );
}

function SeccionGraficos({ stats }) {
  const maxDia = Math.max(...stats.pedidosPorDia.map(d => d.count), 1);
  const maxIng = Math.max(...stats.pedidosPorDia.map(d => d.ingresos), 1);
  const maxHora = Math.max(...stats.porHora, 1);
  const maxSem = Math.max(...stats.porDiaSemana, 1);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-10">
      {/* Pedidos por día */}
      <div className="card p-5 sm:p-6">
        <h3 className="text-base font-semibold text-text mb-1">Pedidos por día</h3>
        <p className="text-xs text-text-muted mb-5">Volumen diario en el rango</p>
        <div className="flex items-end gap-0.5 h-32">
          {stats.pedidosPorDia.map((d) => (
            <div key={d.fecha} className="flex-1 flex flex-col justify-end" title={`${d.fecha}: ${d.count} pedidos`}>
              <div
                className="rounded-t-sm transition-opacity hover:opacity-80"
                style={{
                  height: `${(d.count / maxDia) * 100}%`,
                  minHeight: d.count > 0 ? '4px' : '0',
                  background: ACCENT,
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-2 tabular-nums">
          <span>{stats.pedidosPorDia[0]?.fecha.slice(5)}</span>
          <span>{stats.pedidosPorDia[stats.pedidosPorDia.length - 1]?.fecha.slice(5)}</span>
        </div>
      </div>

      {/* Ingresos por día */}
      <div className="card p-5 sm:p-6">
        <h3 className="text-base font-semibold text-text mb-1">Ingresos por día</h3>
        <p className="text-xs text-text-muted mb-5">Facturación diaria (€)</p>
        <div className="flex items-end gap-0.5 h-32">
          {stats.pedidosPorDia.map((d) => (
            <div key={d.fecha} className="flex-1 flex flex-col justify-end" title={`${d.fecha}: ${d.ingresos.toFixed(2)}€`}>
              <div
                className="rounded-t-sm transition-opacity hover:opacity-80"
                style={{
                  height: `${(d.ingresos / maxIng) * 100}%`,
                  minHeight: d.ingresos > 0 ? '4px' : '0',
                  background: 'rgb(59, 130, 246)',
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-2 tabular-nums">
          <span>{stats.pedidosPorDia[0]?.fecha.slice(5)}</span>
          <span>{stats.pedidosPorDia[stats.pedidosPorDia.length - 1]?.fecha.slice(5)}</span>
        </div>
      </div>

      {/* Pedidos por hora del día */}
      <div className="card p-5 sm:p-6">
        <h3 className="text-base font-semibold text-text mb-1">Pedidos por hora</h3>
        <p className="text-xs text-text-muted mb-5">Distribución durante el día</p>
        <div className="flex items-end gap-0.5 h-32">
          {stats.porHora.map((count, h) => (
            <div key={h} className="flex-1 flex flex-col justify-end" title={`${h}h: ${count} pedidos`}>
              <div
                className="rounded-t-sm transition-opacity hover:opacity-80"
                style={{
                  height: `${(count / maxHora) * 100}%`,
                  minHeight: count > 0 ? '4px' : '0',
                  background: h === stats.horaPico ? ACCENT : 'rgb(var(--border))',
                }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-xs text-text-muted mt-2 tabular-nums">
          <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
        </div>
      </div>

      {/* Pedidos por día de la semana */}
      <div className="card p-5 sm:p-6">
        <h3 className="text-base font-semibold text-text mb-1">Pedidos por día de la semana</h3>
        <p className="text-xs text-text-muted mb-5">¿Qué día tienes más volumen?</p>
        <div className="flex items-end gap-3 h-32">
          {stats.porDiaSemana.map((count, i) => (
            <div key={i} className="flex-1 flex flex-col items-center" title={`${DIAS_SEMANA[i]}: ${count} pedidos`}>
              <div className="w-full flex flex-col justify-end" style={{ height: '90%' }}>
                <div
                  className="rounded-t transition-opacity hover:opacity-80"
                  style={{
                    height: `${(count / maxSem) * 100}%`,
                    minHeight: count > 0 ? '6px' : '0',
                    background: i === stats.diaPico ? ACCENT : 'rgb(var(--border))',
                  }}
                />
              </div>
              <span className={`text-xs mt-2 ${i === stats.diaPico ? 'text-accent font-semibold' : 'text-text-muted'}`}>
                {DIAS_SEMANA[i]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SeccionTopProductos({ stats }) {
  if (stats.topProductos.length === 0) return null;
  const maxUds = stats.topProductos[0].unidades || 1;
  const maxIng = stats.topProductosIngresos[0]?.ingresos || 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-10">
      {/* Top por unidades */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Flame className="w-4 h-4 text-accent" />
          <h3 className="text-base font-semibold text-text">Top 10 más pedidos</h3>
        </div>
        <p className="text-xs text-text-muted mb-5">Por unidades vendidas</p>
        <div className="space-y-2">
          {stats.topProductos.map((p, i) => (
            <div key={p.nombre} className="flex items-center gap-3">
              <span className="text-xs font-bold w-5 text-right text-text-muted tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{p.nombre}</p>
                <div className="h-1.5 rounded-full bg-border/30 mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(p.unidades / maxUds) * 100}%`, background: ACCENT }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-text tabular-nums">{p.unidades}</p>
                <p className="text-xs text-text-muted">uds</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top por facturación */}
      <div className="card p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-1">
          <Euro className="w-4 h-4 text-blue-500" />
          <h3 className="text-base font-semibold text-text">Top 10 que más facturan</h3>
        </div>
        <p className="text-xs text-text-muted mb-5">Por € generados (no por unidades)</p>
        <div className="space-y-2">
          {stats.topProductosIngresos.map((p, i) => (
            <div key={p.nombre} className="flex items-center gap-3">
              <span className="text-xs font-bold w-5 text-right text-text-muted tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{p.nombre}</p>
                <div className="h-1.5 rounded-full bg-border/30 mt-1.5 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${(p.ingresos / maxIng) * 100}%`, background: 'rgb(59, 130, 246)' }} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-text tabular-nums">{p.ingresos.toFixed(0)}€</p>
                <p className="text-xs text-text-muted tabular-nums">{p.unidades} uds</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top menos pedidos */}
      {stats.peoresProductos.length > 0 && (
        <div className="card p-5 sm:p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-text-muted" />
            <h3 className="text-base font-semibold text-text">Top 5 menos pedidos</h3>
          </div>
          <p className="text-xs text-text-muted mb-5">Candidatos a revisar o quitar de la carta</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            {stats.peoresProductos.map((p, i) => (
              <div key={p.nombre} className="flex items-center gap-3">
                <span className="text-xs font-bold w-5 text-right text-text-muted tabular-nums">{i + 1}</span>
                <p className="text-sm font-medium text-text truncate flex-1">{p.nombre}</p>
                <p className="text-sm font-semibold text-text tabular-nums">{p.unidades} uds</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SeccionInsights({ stats }) {
  const horaPicoStr = `${stats.horaPico}:00 - ${stats.horaPico + 1}:00`;
  const diaPicoStr = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][stats.diaPico];

  return (
    <div className="card p-5 sm:p-6">
      <h3 className="text-base font-semibold text-text mb-4">Insights</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <InsightItem icon={Clock} label="Hora pico" valor={horaPicoStr} descripcion="Cuando recibes más pedidos" />
        <InsightItem icon={Calendar} label="Día más fuerte" valor={diaPicoStr} descripcion="El que más volumen mueve" />
        {stats.valoracionMedia !== null && (
          <InsightItem
            icon={Star}
            label="Valoración media"
            valor={stats.valoracionMedia + ' / 5'}
            descripcion={`${stats.numResenas} reseña${stats.numResenas === 1 ? '' : 's'} en el periodo`}
          />
        )}
        {stats.tiempoMedioPrep !== null && (
          <InsightItem icon={Clock} label="Tiempo medio de preparación" valor={stats.tiempoMedioPrep + ' min'} descripcion="De recibido a entregado" />
        )}
        <InsightItem
          icon={stats.pctRecogida > 50 ? Store : Home}
          label="Modo dominante"
          valor={stats.pctRecogida > 50 ? 'Recogida' : 'Domicilio'}
          descripcion={`${stats.pctRecogida}% recogida · ${100 - stats.pctRecogida}% domicilio`}
        />
      </div>
    </div>
  );
}

function InsightItem({ icon: Icon, label, valor, descripcion }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-border/20">
      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-accent" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-text-muted uppercase font-medium tracking-wide">{label}</p>
        <p className="text-base font-bold text-text mt-0.5">{valor}</p>
        <p className="text-xs text-text-muted mt-0.5">{descripcion}</p>
      </div>
    </div>
  );
}

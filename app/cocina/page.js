'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  ChefHat, Home, Store, ArrowLeft, Volume2, VolumeX,
  Check, Loader2, Clock, Flame
} from 'lucide-react';

const HORA_INICIO_DIA = 6;
const BOT_URL = 'https://bot-pedidos-production-f2b2.up.railway.app';

function inicioDiaTrabajo() {
  const ahora = new Date();
  const inicio = new Date(ahora);
  inicio.setHours(HORA_INICIO_DIA, 0, 0, 0);
  if (ahora.getHours() < HORA_INICIO_DIA) {
    inicio.setDate(inicio.getDate() - 1);
  }
  return inicio.getTime();
}

function minutosDesde(iso) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 1000 / 60);
}

// Devuelve clases visuales según cuánto lleva esperando el pedido
function estilosUrgencia(min) {
  if (min >= 20) {
    return {
      border: 'border-red-500',
      ring: 'ring-2 ring-red-500/30',
      label: 'text-red-500 dark:text-red-400',
      pulse: 'animate-pulse-soft',
    };
  }
  if (min >= 10) {
    return {
      border: 'border-yellow-500/60',
      ring: '',
      label: 'text-yellow-600 dark:text-yellow-400',
      pulse: '',
    };
  }
  return {
    border: 'border-border',
    ring: '',
    label: 'text-text-muted',
    pulse: '',
  };
}

export default function PaginaCocina() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [pedidos, setPedidos] = useState([]);
  const [lineasPorPedido, setLineasPorPedido] = useState({});
  const [restaurante, setRestaurante] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sonidoActivo, setSonidoActivo] = useState(true);
  const [marcandoIds, setMarcandoIds] = useState(new Set());
  // Tick para refrescar tiempos sin recargar datos
  const [, setTick] = useState(0);

  const audioRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (restId) {
        const { data: rest } = await supabase
          .from('restaurantes').select('id, nombre, logo_url').eq('id', restId).maybeSingle();
        if (rest) setRestaurante(rest);
      }
      await cargarPedidos();
      setCargando(false);
    }
    init();
  }, []);

  useEffect(() => {
    const canal = supabase.channel('cocina-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => {
        if (sonidoActivo && audioRef.current) audioRef.current.play().catch(() => {});
        cargarPedidos();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, () => cargarPedidos())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [sonidoActivo]);

  // Refresca tiempos cada 30 segundos
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  async function cargarPedidos() {
    const inicioHoy = inicioDiaTrabajo();
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .eq('estado', 'recibido')
      .gte('creado_en', new Date(inicioHoy).toISOString())
      .order('creado_en', { ascending: true });

    const filtrados = data || [];
    setPedidos(filtrados);

    if (filtrados.length > 0) {
      const ids = filtrados.map(p => p.id);
      const { data: lineas } = await supabase
        .from('lineas_pedido')
        .select('*')
        .in('pedido_id', ids);
      const porPedido = {};
      (lineas || []).forEach(l => {
        if (!porPedido[l.pedido_id]) porPedido[l.pedido_id] = [];
        porPedido[l.pedido_id].push(l);
      });
      setLineasPorPedido(porPedido);
    } else {
      setLineasPorPedido({});
    }
  }

  async function marcarListo(pedido) {
    setMarcandoIds(prev => new Set(prev).add(pedido.id));
    await supabase.from('pedidos').update({ estado: 'listo' }).eq('id', pedido.id);
    // Notificar al cliente (el bot decide: solo avisa si es recogida)
    fetch(BOT_URL + '/notificar-estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedido.id, nuevo_estado: 'listo' })
    }).catch(() => {});
    // El realtime recargará automáticamente, pero también actualizamos local por si acaso
    setTimeout(() => {
      setMarcandoIds(prev => {
        const copia = new Set(prev);
        copia.delete(pedido.id);
        return copia;
      });
    }, 1000);
  }

  function alternarSonido() {
    setSonidoActivo(s => !s);
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <audio
        ref={audioRef}
        src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
        preload="auto"
      />

      {/* Header de cocina — sticky, contraste alto */}
      <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-md border-b-2 border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <ChefHat className="w-5 h-5 text-accent" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-base font-bold text-text">Cocina</h1>
              {restaurante?.nombre && (
                <p className="text-xs text-text-muted">{restaurante.nombre}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={alternarSonido}
              className="btn-ghost p-2.5"
              title={sonidoActivo ? 'Silenciar' : 'Activar sonido'}
            >
              {sonidoActivo ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            <a href="/pedidos" className="btn-secondary">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver al panel</span>
            </a>
          </div>
        </div>
      </header>

      {/* Contador y estado */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-text tabular-nums">
              {pedidos.length === 0 ? 'Sin pedidos pendientes' :
                pedidos.length === 1 ? '1 pedido pendiente' :
                pedidos.length + ' pedidos pendientes'}
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Ordenados por antigüedad. Pulsa <strong className="text-text">LISTO</strong> cuando termines de preparar cada uno.
            </p>
          </div>
        </div>

        {pedidos.length === 0 ? (
          <div className="card p-12 text-center">
            <Flame className="w-12 h-12 text-text-muted mx-auto mb-4 opacity-50" />
            <p className="text-lg text-text font-medium mb-2">Todo al día</p>
            <p className="text-sm text-text-muted">Cuando llegue un pedido nuevo, aparecerá aquí automáticamente.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5 pb-12">
            {pedidos.map(p => {
              const min = minutosDesde(p.creado_en);
              const urgencia = estilosUrgencia(min);
              const lineas = lineasPorPedido[p.id] || [];
              const esRecogida = p.tipo_entrega === 'recogida';
              const marcando = marcandoIds.has(p.id);

              return (
                <div
                  key={p.id}
                  className={`card p-5 sm:p-6 border-2 ${urgencia.border} ${urgencia.ring} ${urgencia.pulse} flex flex-col`}
                >
                  {/* Cabecera del pedido */}
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="text-3xl sm:text-4xl font-bold text-text tabular-nums">
                        #{p.id.slice(-4).toUpperCase()}
                      </p>
                      <div className={`flex items-center gap-1.5 text-sm font-medium mt-1 ${urgencia.label}`}>
                        <Clock className="w-4 h-4" />
                        <span className="tabular-nums">
                          Hace {min === 0 ? 'menos de un minuto' : min === 1 ? '1 minuto' : min + ' minutos'}
                        </span>
                      </div>
                    </div>
                    <span className={`badge border ${esRecogida
                      ? 'bg-accent/10 text-accent border-accent/20'
                      : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                    }`}>
                      {esRecogida ? <Store className="w-3 h-3" /> : <Home className="w-3 h-3" />}
                      {esRecogida ? 'Recogida' : 'Domicilio'}
                    </span>
                  </div>

                  {/* Lista de productos */}
                  <div className="space-y-2 mb-5 flex-1">
                    {lineas.length === 0 ? (
                      <p className="text-sm text-text-muted italic">Cargando productos...</p>
                    ) : (
                      lineas.map(l => (
                        <div key={l.id} className="pb-2 border-b border-border last:border-b-0 last:pb-0">
                          <p className="text-lg sm:text-xl text-text">
                            <span className="font-bold tabular-nums">{l.cantidad}×</span>{' '}
                            <span className="font-medium">{l.nombre_producto}</span>
                          </p>
                          {l.notas && l.notas.trim() !== '' && (
                            <p className="text-sm text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-2 py-1 mt-1.5 italic">
                              → {l.notas}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Botón gordo de LISTO */}
                  <button
                    onClick={() => marcarListo(p)}
                    disabled={marcando}
                    className="w-full py-4 sm:py-5 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-lg sm:text-xl font-bold flex items-center justify-center gap-2 transition-colors"
                  >
                    {marcando ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Marcando...
                      </>
                    ) : (
                      <>
                        <Check className="w-6 h-6" strokeWidth={3} />
                        LISTO
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

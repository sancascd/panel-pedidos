'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import MenuNav from '@/components/MenuNav';
import {
  ArrowLeft, Gauge, TrendingUp, Loader2, AlertCircle, CheckCircle2,
  ArrowUpCircle, Check, Clock
} from 'lucide-react';
import {
  PLANES, ORDEN_PLANES, infoPlan, planSiguiente,
  periodoActual, calcularConsumo, recomendacionUpgrade
} from '@/lib/planes';

export default function PaginaPlan() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [restaurante, setRestaurante] = useState(null);
  const [pedidosPeriodo, setPedidosPeriodo] = useState(0);
  const [periodo, setPeriodo] = useState(null);
  const [solicitudPendiente, setSolicitudPendiente] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: 'success' });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) { setCargando(false); return; }

      const { data: rest } = await supabase
        .from('restaurantes')
        .select('id, nombre, plan, plan_iniciado_en')
        .eq('id', restId)
        .maybeSingle();
      if (!rest) { setCargando(false); return; }
      setRestaurante(rest);

      // Periodo actual (mes desde fecha de alta del plan)
      const per = periodoActual(rest.plan_iniciado_en);
      setPeriodo(per);

      // Contar TODOS los pedidos del periodo (decisión: cuentan todos los recibidos)
      const { count } = await supabase
        .from('pedidos')
        .select('*', { count: 'exact', head: true })
        .eq('restaurante_id', restId)
        .gte('creado_en', per.inicio.toISOString());
      setPedidosPeriodo(count || 0);

      // ¿Hay una solicitud de upgrade pendiente?
      const { data: sol } = await supabase
        .from('solicitudes_upgrade')
        .select('*')
        .eq('restaurante_id', restId)
        .eq('estado', 'pendiente')
        .order('solicitado_en', { ascending: false })
        .limit(1)
        .maybeSingle();
      setSolicitudPendiente(sol || null);

      setCargando(false);
    }
    init();
  }, []);

  function avisar(texto, tipo = 'success') {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: 'success' }), 6000);
  }

  async function solicitarUpgrade(planSolicitado) {
    if (!restaurante) return;
    setEnviando(true);
    const { data, error } = await supabase
      .from('solicitudes_upgrade')
      .insert({
        restaurante_id: restaurante.id,
        plan_actual: restaurante.plan,
        plan_solicitado: planSolicitado,
        estado: 'pendiente'
      })
      .select()
      .single();
    setEnviando(false);
    if (error) {
      avisar('No se pudo enviar la solicitud. Inténtalo de nuevo.', 'error');
      return;
    }
    setSolicitudPendiente(data);
    avisar('Solicitud enviada. La revisaremos y te confirmaremos el cambio.', 'success');
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!restaurante) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <AlertCircle className="w-8 h-8 text-text-muted" />
        <p className="text-text">No encontramos tu restaurante.</p>
        <a href="/pedidos" className="btn-secondary">Volver al panel</a>
      </div>
    );
  }

  const plan = infoPlan(restaurante.plan);
  const consumo = calcularConsumo({
    planId: restaurante.plan,
    pedidosPeriodo,
    diasTranscurridos: periodo?.diasTranscurridos || 1,
    diasTotales: periodo?.diasTotales || 30,
  });
  const reco = recomendacionUpgrade({ planId: restaurante.plan, proyeccion: consumo.proyeccion });

  // Color de la barra según nivel
  const colorBarra =
    consumo.nivelAviso === 'exceso' || consumo.nivelAviso === 'limite' ? 'bg-red-500' :
    consumo.nivelAviso === 'aviso' ? 'bg-yellow-500' : 'bg-accent';

  const fmtFecha = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '';

  // Planes superiores al actual (para solicitar)
  const planesSuperiores = ORDEN_PLANES
    .slice(ORDEN_PLANES.indexOf(restaurante.plan) + 1)
    .map(infoPlan);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Gauge className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Tu plan</h1>
              <p className="text-xs text-text-muted hidden sm:block">Consumo y facturación</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/pedidos" className="btn-ghost">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </a>
            <div className="h-6 w-px bg-border mx-1" />
            <MenuNav />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {mensaje.texto && (
          <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm animate-fade-in ${
            mensaje.tipo === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
              : 'bg-accent/10 border-accent/20 text-accent'
          }`}>
            {mensaje.tipo === 'error'
              ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{mensaje.texto}</span>
          </div>
        )}

        {/* Plan actual + consumo */}
        <div className="card p-6">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-5">
            <div>
              <p className="text-xs text-text-muted uppercase tracking-wide">Plan actual</p>
              <div className="flex items-baseline gap-2 mt-1">
                <h2 className="text-2xl font-bold text-text">{plan.nombre}</h2>
                <span className="text-text-muted text-sm tabular-nums">{plan.precio}€/mes</span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-text-muted">Periodo actual</p>
              <p className="text-sm text-text tabular-nums">
                {fmtFecha(periodo?.inicio)} – {fmtFecha(periodo?.fin)}
              </p>
            </div>
          </div>

          {/* Barra de consumo */}
          <div className="mb-2 flex items-end justify-between">
            <span className="text-sm text-text">
              <strong className="tabular-nums">{consumo.consumidos}</strong>
              <span className="text-text-muted"> / {consumo.incluidos} pedidos</span>
            </span>
            <span className={`text-sm font-semibold tabular-nums ${
              consumo.nivelAviso === 'exceso' || consumo.nivelAviso === 'limite' ? 'text-red-500'
              : consumo.nivelAviso === 'aviso' ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-text-muted'
            }`}>
              {Math.round(consumo.porcentaje * 100)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${colorBarra}`}
              style={{ width: `${Math.round(consumo.porcentajeBarra * 100)}%` }}
            />
          </div>

          {/* Overage actual si lo hay */}
          {consumo.overagePedidos > 0 && (
            <p className="text-sm text-red-500 mt-3">
              Llevas <strong className="tabular-nums">{consumo.overagePedidos}</strong> pedidos por encima de tu plan
              · <strong className="tabular-nums">+{consumo.overageCoste.toFixed(2)}€</strong> en extra ({plan.overage.toFixed(2)}€/pedido)
            </p>
          )}

          {/* Proyección */}
          <div className="mt-5 pt-5 border-t border-border grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-text-muted flex items-center gap-1">
                <Clock className="w-3 h-3" /> Día del periodo
              </p>
              <p className="text-lg font-semibold text-text tabular-nums mt-0.5">
                {periodo?.diasTranscurridos}/{periodo?.diasTotales}
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Proyección fin de mes
              </p>
              <p className="text-lg font-semibold text-text tabular-nums mt-0.5">
                ~{consumo.proyeccion} pedidos
              </p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Coste estimado del mes</p>
              <p className="text-lg font-semibold text-text tabular-nums mt-0.5">
                {consumo.costeEstimadoMes.toFixed(2)}€
              </p>
            </div>
          </div>
        </div>

        {/* Recomendación de upgrade */}
        {reco && reco.recomendar && (
          <div className="card p-5 border-accent/30 bg-accent/5">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/15 flex items-center justify-center flex-shrink-0">
                <ArrowUpCircle className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-text mb-1">
                  Te conviene pasar a {reco.siguiente.nombre}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  Según tu ritmo, este mes proyectas ~{consumo.proyeccion} pedidos. Con tu plan actual
                  pagarías unos <strong className="text-text tabular-nums">{reco.costeActual.toFixed(2)}€</strong>;
                  con {reco.siguiente.nombre} (<span className="tabular-nums">{reco.siguiente.precio}€</span> ·
                  {' '}{reco.siguiente.pedidosIncluidos} pedidos) serían
                  {' '}<strong className="text-text tabular-nums">{reco.costeSiguiente.toFixed(2)}€</strong>
                  {reco.ahorro > 0 && <> — ahorras <strong className="text-accent tabular-nums">{reco.ahorro.toFixed(2)}€/mes</strong></>}.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Solicitud pendiente o botones para solicitar */}
        {solicitudPendiente ? (
          <div className="card p-5 border-yellow-500/30 bg-yellow-500/5">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-text">
                  Solicitud de cambio a {infoPlan(solicitudPendiente.plan_solicitado).nombre} pendiente
                </p>
                <p className="text-xs text-text-muted mt-0.5">
                  La estamos revisando. Te confirmaremos el cambio en breve.
                </p>
              </div>
            </div>
          </div>
        ) : planesSuperiores.length > 0 ? (
          <div className="card p-6">
            <h3 className="text-base font-semibold text-text mb-1">Cambiar de plan</h3>
            <p className="text-sm text-text-muted mb-4">
              Solicita el cambio y lo aplicamos tras confirmarlo contigo. Sin permanencia.
            </p>
            <div className="space-y-3">
              {planesSuperiores.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border">
                  <div>
                    <p className="font-medium text-text">{p.nombre}</p>
                    <p className="text-xs text-text-muted tabular-nums">
                      {p.precio}€/mes · {p.pedidosIncluidos} pedidos · +{p.overage.toFixed(2)}€ extra
                    </p>
                  </div>
                  <button
                    onClick={() => solicitarUpgrade(p.id)}
                    disabled={enviando}
                    className="btn-primary"
                  >
                    {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Solicitar'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card p-5 text-center">
            <Check className="w-6 h-6 text-accent mx-auto mb-2" />
            <p className="text-sm text-text">Estás en el plan más alto. ¡Gracias por confiar en nosotros!</p>
          </div>
        )}

        <p className="text-xs text-text-muted text-center">
          El periodo se cuenta desde la fecha de alta de tu plan. Los pedidos por encima del límite
          se facturan a {plan.overage.toFixed(2)}€ cada uno. Precios con IVA incluido.
        </p>
      </main>
    </div>
  );
}

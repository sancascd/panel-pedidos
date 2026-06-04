'use client';

import { useState, useEffect, useRef, Children } from 'react';
import Link from 'next/link';
import {
  MessageSquare, Bot, LayoutDashboard, Check, Star, Bell,
  Smartphone, Zap, ShieldCheck, Sparkles, ArrowRight,
  ChevronDown, QrCode, Image as ImageIcon, BarChart3, Gauge,
  TrendingUp, BellRing
} from 'lucide-react';

const WHATSAPP_VENTAS = '34685246694';
const MENSAJE_DEMO = 'Hola, me interesa Comandi para mi restaurante. ¿Podemos hablar?';
// Verde de Comandi en hex, para inline-styles que NO dependan de variables CSS
const ACCENT_HEX = '#10b981';

function urlWhatsApp() {
  return 'https://wa.me/' + WHATSAPP_VENTAS + '?text=' + encodeURIComponent(MENSAJE_DEMO);
}

// Hook: posición de scroll suavizada con requestAnimationFrame
function useScrollPosition() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollY(window.scrollY);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return scrollY;
}

// Hook: progreso de scroll para un elemento (0-1)
// Devuelve cuánto ha entrado el elemento en su zona de animación
function useScrollProgress(ref, { start = 0.92, end = 0.45 } = {}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined' || !ref.current) return;

    let rafId = null;
    const update = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const wh = window.innerHeight;
      const startY = wh * start;
      const endY = wh * end;
      const range = startY - endY;
      const raw = (startY - rect.top) / range;
      const clamped = Math.max(0, Math.min(1, raw));
      setProgress(clamped);
      rafId = null;
    };

    const onScroll = () => {
      if (rafId === null) rafId = requestAnimationFrame(update);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [ref, start, end]);

  return progress;
}

// Helper: aplica Reveal a cada hijo con un offset escalonado en el scroll
function StaggerChildren({ children, className = '', baseOffset = 0, stagger = 0.06 }) {
  return (
    <div className={className}>
      {Children.map(children, (child, i) => (
        <Reveal key={i} offset={baseOffset + i * stagger}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

// Componente: la opacidad/posición/escala se ligan DIRECTAMENTE al scroll.
// El elemento se "desliza" según el usuario va haciendo scroll, sin trigger.
function Reveal({ children, className = '', offset = 0 }) {
  const ref = useRef(null);
  const progress = useScrollProgress(ref, {
    start: 0.92 - offset * 0.08,
    end: 0.50 - offset * 0.08,
  });
  // Curva ease-out cúbica para suavizar el progreso (parece más natural)
  const eased = 1 - Math.pow(1 - progress, 3);

  return (
    <div
      ref={ref}
      style={{
        opacity: eased,
        transform: `translateY(${(1 - eased) * 80}px) scale(${0.92 + eased * 0.08})`,
        filter: `blur(${(1 - eased) * 8}px)`,
        willChange: 'opacity, transform, filter',
      }}
      className={className}
    >
      {children}
    </div>
  );
}

function BurbujaUsuario({ children, hora }) {
  return (
    <div className="flex justify-end animate-slide-up">
      <div className="bg-emerald-900/40 rounded-2xl rounded-br-md px-3 sm:px-3.5 py-1.5 sm:py-2 max-w-[85%] shadow-sm">
        <div className="text-[13px] sm:text-sm text-zinc-100 leading-snug">{children}</div>
        <p className="text-[10px] text-zinc-400 text-right mt-1">{hora} ✓✓</p>
      </div>
    </div>
  );
}

function BurbujaBot({ children, hora }) {
  return (
    <div className="flex justify-start animate-slide-up">
      <div className="bg-zinc-800 rounded-2xl rounded-bl-md px-3 sm:px-3.5 py-1.5 sm:py-2 max-w-[88%] shadow-sm">
        <div className="text-[13px] sm:text-sm text-zinc-100 leading-snug">{children}</div>
        <p className="text-[10px] text-zinc-400 text-right mt-1">{hora}</p>
      </div>
    </div>
  );
}

function Escribiendo() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  );
}

function MockupChat() {
  // Pasos: 0 nada | 1 msg1 | 2 escribiendo | 3 bot1 | 4 msg2 | 5 escribiendo | 6 bot2 | 7 pausa
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    const duraciones = {
      0: 600,   // arranque
      1: 900,   // usuario 1
      2: 1400,  // escribiendo
      3: 2200,  // bot 1
      4: 900,   // usuario 2
      5: 1400,  // escribiendo
      6: 5000,  // bot 2 + pausa
    };
    const siguiente = (paso + 1) % 7;
    const t = setTimeout(() => setPaso(siguiente), duraciones[paso] || 1000);
    return () => clearTimeout(t);
  }, [paso]);

  return (
    <div className="relative max-w-md mx-auto isolate">
      {/* Halo decorativo con respiración — sigue la forma del chat */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-3xl animate-pulse-soft pointer-events-none"
        style={{ boxShadow: '0 0 80px 6px rgba(16, 185, 129, 0.4), 0 0 30px 0 rgba(16, 185, 129, 0.55)' }}
      />

      <div className="relative bg-surface border border-border rounded-3xl shadow-lift overflow-hidden">
        {/* Header */}
        <div className="px-3 sm:px-4 py-2.5 sm:py-3 bg-gradient-to-br from-emerald-700 to-emerald-800 flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-sm font-bold shadow-soft">
              BN
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 rounded-full ring-2 ring-emerald-700 animate-pulse-soft" />
          </div>
          <div className="flex-1">
            <p className="text-white text-sm font-medium">Brasa Negra</p>
            <p className="text-white/70 text-xs">en línea</p>
          </div>
          <MessageSquare className="w-4 h-4 text-white/60" />
        </div>

        {/* Chat area */}
        <div className="bg-zinc-900 p-3 sm:p-4 space-y-2 sm:space-y-2.5 h-[440px] sm:h-[540px]">
          {paso >= 1 && (
            <BurbujaUsuario hora="21:14" key="u1">
              Hola, quería pedir 2 hamburguesas BBQ y una Coca-Cola Zero
            </BurbujaUsuario>
          )}

          {paso === 2 && <Escribiendo key="t1" />}

          {paso >= 3 && (
            <BurbujaBot hora="21:14" key="b1">
              <p>¡Hola! Tu pedido:</p>
              <p className="font-medium mt-1">
                2× Hamburguesa BBQ — 16,00€<br />
                1× Coca-Cola Zero — 2,50€
              </p>
              <p className="mt-1">Total: <strong>18,50€</strong></p>
              <p className="mt-1">¿Confirmas?</p>
            </BurbujaBot>
          )}

          {paso >= 4 && (
            <BurbujaUsuario hora="21:15" key="u2">
              Sí, y ponme también 1 ración de patatas
            </BurbujaUsuario>
          )}

          {paso === 5 && <Escribiendo key="t2" />}

          {paso >= 6 && (
            <BurbujaBot hora="21:15" key="b2">
              <p>Actualizado:</p>
              <p className="font-medium mt-1">
                2× Hamburguesa BBQ — 16,00€<br />
                1× Coca-Cola Zero — 2,50€<br />
                1× Patatas — 3,50€
              </p>
              <p className="mt-1">Total: <strong>22,00€</strong></p>
              <p className="mt-1">¿Lo dejamos así?</p>
            </BurbujaBot>
          )}
        </div>
      </div>
    </div>
  );
}

function PasoCard({ numero, icono: Icono, titulo, texto }) {
  return (
    <div className="relative card p-6 h-full">
      <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center text-sm font-semibold shadow-lift">
        {numero}
      </div>
      <Icono className="w-6 h-6 text-accent mb-3" />
      <h3 className="text-base font-semibold text-text mb-1.5">{titulo}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{texto}</p>
    </div>
  );
}

function FeatureCard({ icono: Icono, titulo, texto }) {
  return (
    <div className="relative card p-4 sm:p-5 h-full">
      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
        <Icono className="w-4 h-4 text-accent" />
      </div>
      <h3 className="text-sm font-semibold text-text mb-1.5">{titulo}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{texto}</p>
    </div>
  );
}

function FAQItem({ pregunta, respuesta }) {
  return (
    <details className="group card p-5 cursor-pointer">
      <summary className="flex items-center justify-between text-sm font-medium text-text list-none">
        <span>{pregunta}</span>
        <ChevronDown className="w-4 h-4 text-text-muted transition-transform group-open:rotate-180" />
      </summary>
      <p className="text-sm text-text-muted mt-3 leading-relaxed">{respuesta}</p>
    </details>
  );
}

function PlanCard({ nombre, precio, pedidos, recomendado, features }) {
  return (
    <div className={`relative card p-5 md:p-6 flex flex-col h-full ${
      recomendado ? 'border-accent ring-1 ring-accent shadow-lift' : ''
    }`}>
      {recomendado && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-accent text-white text-xs font-semibold whitespace-nowrap">
          Más popular
        </div>
      )}
      <div className="mb-4 md:mb-5">
        <h3 className="text-lg font-semibold text-text">{nombre}</h3>
        <div className="mt-2 md:mt-3 flex items-baseline gap-1">
          <span className="text-3xl md:text-4xl font-bold text-text tabular-nums">{precio}€</span>
          <span className="text-text-muted text-sm">/mes</span>
        </div>
        <p className="text-sm text-text-muted mt-1.5">
          Hasta <strong className="text-text tabular-nums">{pedidos}</strong> pedidos al mes
        </p>
      </div>

      <ul className="space-y-2 md:space-y-2.5 flex-1 mb-4 md:mb-6">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-text">
            <Check className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <a
        href={urlWhatsApp()}
        target="_blank"
        rel="noopener noreferrer"
        className={recomendado ? 'btn-primary w-full' : 'btn-secondary w-full'}
      >
        Empezar
        <ArrowRight className="w-4 h-4" />
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OPCIÓN 4 — Banda de impacto (números que se animan al aparecer)
// ─────────────────────────────────────────────────────────────
function ContadorImpacto({ valor, sufijo, etiqueta, activo }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!activo) return;
    let raf;
    const dur = 1200;
    const inicio = performance.now();
    const tick = (ahora) => {
      const p = Math.min(1, (ahora - inicio) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(valor * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [activo, valor]);

  return (
    <div className="p-6 sm:p-7 text-center">
      <div className="text-4xl sm:text-5xl font-bold tabular-nums" style={{ color: ACCENT_HEX }}>
        {n}{sufijo}
      </div>
      <p className="mt-2 text-sm text-text-muted">{etiqueta}</p>
    </div>
  );
}

function BandaImpacto() {
  const ref = useRef(null);
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((e) => {
          if (e.isIntersecting) { setActivo(true); io.disconnect(); }
        });
      },
      { threshold: 0.4 }
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-2 pb-6 sm:pb-10">
      <Reveal>
        <div ref={ref} className="card overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-border">
            <ContadorImpacto valor={3} sufijo=" h" etiqueta="ahorradas a la semana" activo={activo} />
            <ContadorImpacto valor={0} sufijo="%" etiqueta="de comisión por pedido" activo={activo} />
            <ContadorImpacto valor={24} sufijo=" h" etiqueta="para tenerlo funcionando" activo={activo} />
            <ContadorImpacto valor={100} sufijo="%" etiqueta="de pedidos por escrito" activo={activo} />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// OPCIÓN 3 — El viaje de un pedido (flujo animado)
// ─────────────────────────────────────────────────────────────
function PasoViaje({ icono: Icono, paso, titulo, texto }) {
  return (
    <div className="text-center">
      <div className="mx-auto w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-3">
        <Icono className="w-6 h-6 text-accent" />
      </div>
      <p className="text-xs font-semibold text-accent mb-1">{paso}</p>
      <h3 className="text-sm font-semibold text-text">{titulo}</h3>
      <p className="text-xs text-text-muted mt-1 leading-relaxed">{texto}</p>
    </div>
  );
}

function ViajePedido() {
  return (
    <div className="card p-6 sm:p-10 bg-gradient-to-br from-surface to-surface-2">
      {/* Pista con el punto que viaja de paso a paso */}
      <div className="relative mb-10">
        <div className="h-0.5 bg-border rounded-full" />
        <div
          className="absolute -top-1.5 h-3.5 w-3.5 rounded-full animate-travel"
          style={{ backgroundColor: ACCENT_HEX, boxShadow: '0 0 16px 3px rgba(16,185,129,0.7)' }}
          aria-hidden
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-5">
        <PasoViaje
          icono={MessageSquare}
          paso="Paso 1"
          titulo="El cliente escribe"
          texto="Por su WhatsApp de siempre. Sin descargar nada."
        />
        <PasoViaje
          icono={Bot}
          paso="Paso 2"
          titulo="La IA lo entiende"
          texto="Aunque escriba con faltas o cambie el pedido a medias."
        />
        <PasoViaje
          icono={LayoutDashboard}
          paso="Paso 3"
          titulo="Llega a tu panel"
          texto="Ordenado, listo para imprimir y cocinar."
        />
        <PasoViaje
          icono={BellRing}
          paso="Paso 4"
          titulo="El cliente, avisado"
          texto="Recibe el aviso de 'listo' solo. Sin que tengas que llamar."
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// OPCIÓN 5 — Mira Comandi por dentro (showcase interactivo)
// ─────────────────────────────────────────────────────────────
function DemoKanban() {
  return (
    <div>
      <h3 className="text-base font-semibold text-text mb-1">Tus pedidos del día, en columnas</h3>
      <p className="text-sm text-text-muted mb-5">De &ldquo;Recibido&rdquo; a &ldquo;Listo&rdquo; con un clic. El cliente recibe el aviso solo.</p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div>
          <p className="text-[11px] font-semibold text-text-muted mb-2">Recibidos</p>
          <div className="rounded-lg bg-accent/10 border border-accent/30 p-2.5 mb-2">
            <p className="text-[11px] font-bold text-text">#0148</p>
            <p className="text-[10px] text-text-muted">2× BBQ · Zero · 18,50€</p>
          </div>
          <div className="rounded-lg bg-surface-2 border border-border p-2.5">
            <p className="text-[11px] font-bold text-text">#0149</p>
            <p className="text-[10px] text-text-muted">Pizza · 12,00€</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-text-muted mb-2">Preparación</p>
          <div className="rounded-lg bg-surface-2 border border-border p-2.5">
            <p className="text-[11px] font-bold text-text">#0147</p>
            <p className="text-[10px] text-text-muted">Kebab × 2</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold text-text-muted mb-2">Listos</p>
          <div className="rounded-lg bg-surface-2 border border-border p-2.5 opacity-70">
            <p className="text-[11px] font-bold text-text">#0146</p>
            <p className="text-[10px] text-accent">Avisado ✓</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoAnalitica() {
  const barras = [40, 62, 50, 78, 68, 95, 85];
  return (
    <div>
      <h3 className="text-base font-semibold text-text mb-1">Sabe qué se vende y cuándo</h3>
      <p className="text-sm text-text-muted mb-5">Ingresos por día, productos top y tendencia frente al mes pasado.</p>
      <div className="flex items-end gap-2 h-32 mb-3">
        {barras.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-md bg-accent"
            style={{ height: `${h}%`, opacity: 0.35 + (i / (barras.length - 1)) * 0.65 }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-accent font-medium">
        <TrendingUp className="w-4 h-4" /> +18% frente al mes anterior
      </div>
    </div>
  );
}

function DemoResenas() {
  return (
    <div>
      <h3 className="text-base font-semibold text-text mb-1">Feedback sin tener que pedirlo</h3>
      <p className="text-sm text-text-muted mb-5">Tras entregar, el bot pregunta. Tú recibes la valoración real.</p>
      <div className="space-y-2.5 max-w-md">
        <div className="rounded-xl border border-border bg-surface-2 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-text">Pedido #0146</p>
            <p className="text-[11px] text-text-muted">&ldquo;Todo perfecto y rápido 👌&rdquo;</p>
          </div>
          <div className="text-accent text-sm">★★★★★</div>
        </div>
        <div className="rounded-xl border border-border bg-surface-2 p-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-text">Pedido #0142</p>
            <p className="text-[11px] text-text-muted">&ldquo;Muy bueno, repetiré&rdquo;</p>
          </div>
          <div className="text-sm"><span className="text-accent">★★★★</span><span className="text-text-muted">★</span></div>
        </div>
        <div className="text-xs text-text-muted flex items-center gap-1.5">
          <Star className="w-3.5 h-3.5 text-accent" /> Media: <strong className="text-text">4,8</strong> / 5
        </div>
      </div>
    </div>
  );
}

function DemoPlan() {
  return (
    <div>
      <h3 className="text-base font-semibold text-text mb-1">Tu consumo, siempre a la vista</h3>
      <p className="text-sm text-text-muted mb-5">Sabes cuántos pedidos llevas y te avisamos antes de pasarte.</p>
      <div className="max-w-md rounded-xl border border-border bg-surface-2 p-4">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-text">Plan Básico</span>
          <span className="text-text-muted tabular-nums">438 / 600 pedidos</span>
        </div>
        <div className="h-3 rounded-full bg-border overflow-hidden">
          <div className="h-full rounded-full bg-accent" style={{ width: '73%' }} />
        </div>
        <p className="mt-3 text-[11px] text-text-muted leading-relaxed">
          Vas al 73% del plan. A este ritmo llegarás a ~600. Te avisaremos si te conviene subir a Pro.
        </p>
      </div>
    </div>
  );
}

const FEATURES_DEMO = [
  { key: 'kanban', icono: LayoutDashboard, label: 'Panel de pedidos', Comp: DemoKanban },
  { key: 'analitica', icono: BarChart3, label: 'Analíticas', Comp: DemoAnalitica },
  { key: 'resenas', icono: Star, label: 'Reseñas automáticas', Comp: DemoResenas },
  { key: 'plan', icono: Gauge, label: 'Tu plan sin sorpresas', Comp: DemoPlan },
];

function MiraPorDentro() {
  const [activa, setActiva] = useState('kanban');
  const Activa = FEATURES_DEMO.find((f) => f.key === activa)?.Comp || DemoKanban;

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto mb-10 sm:mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">Mira Comandi por dentro</h2>
          <p className="mt-3 text-text-muted">
            Toca cada función y verás cómo es de verdad. Sin registrarte, sin instalar nada.
          </p>
        </div>
      </Reveal>
      <Reveal>
        <div className="grid lg:grid-cols-[260px_1fr] gap-4 sm:gap-5">
          {/* Selector */}
          <div className="flex lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
            {FEATURES_DEMO.map((f) => {
              const on = activa === f.key;
              const Icono = f.icono;
              return (
                <button
                  key={f.key}
                  onClick={() => setActiva(f.key)}
                  aria-pressed={on}
                  className={`shrink-0 text-left px-4 py-3 rounded-xl border flex items-center gap-3 transition-colors ${
                    on ? 'border-accent/40 bg-accent/10' : 'border-border hover:bg-surface-2'
                  }`}
                >
                  <Icono className={`w-4 h-4 ${on ? 'text-accent' : 'text-text-muted'}`} />
                  <span className={`text-sm font-medium whitespace-nowrap ${on ? 'text-text' : 'text-text-muted'}`}>
                    {f.label}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Escenario */}
          <div className="card p-5 sm:p-7 min-h-[300px] sm:min-h-[320px]">
            <Activa />
          </div>
        </div>
      </Reveal>
    </section>
  );
}

// Colores fijos para la landing (los del modo oscuro de Comandi).
// Se aplican inline para que no haya ningún flash gris mientras carga el CSS.
const TEMA_LANDING = {
  '--bg': '9 9 11',
  '--surface': '24 24 27',
  '--surface-2': '39 39 42',
  '--border': '39 39 42',
  '--text': '250 250 250',
  '--text-muted': '161 161 170',
  '--accent': '16 185 129',
  '--accent-hover': '52 211 153',
  backgroundColor: 'rgb(9 9 11)',
  color: 'rgb(250 250 250)',
  colorScheme: 'dark',
};

export default function PaginaLanding() {
  const scrollY = useScrollPosition();
  const scrolled = scrollY > 20;

  return (
    <div className="min-h-screen overflow-x-hidden" style={TEMA_LANDING}>
      {/* Fondo decorativo del hero — con parallax y fade */}
      <div
        className="fixed inset-x-0 top-0 h-[700px] -z-10 pointer-events-none"
        style={{
          transform: `translateY(${-scrollY * 0.5}px) scale(${Math.max(0.7, 1 - scrollY / 1200)})`,
          opacity: Math.max(0, 1 - scrollY / 500)
        }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[800px]"
          style={{ background: 'radial-gradient(ellipse at top, rgba(16, 185, 129, 0.18) 0%, rgba(16, 185, 129, 0.05) 35%, transparent 70%)' }}
        />
      </div>

      {/* Header de la landing — dinámico al scroll */}
      <header className={`sticky top-0 z-30 border-b transition-all duration-300 ${
        scrolled
          ? 'bg-bg/95 backdrop-blur-xl border-border/70 shadow-card'
          : 'bg-bg/80 backdrop-blur-md border-border'
      }`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 sm:w-4 sm:h-4 text-accent" strokeWidth={2.5} />
            </div>
            <span className="text-lg sm:text-base font-bold tracking-tight text-text">Comandi</span>
          </div>
          <nav className="flex items-center gap-2">
            <a href="#como-funciona" className="nav-link hidden sm:inline-flex">Cómo funciona</a>
            <a href="#precio" className="nav-link hidden sm:inline-flex">Precio</a>
            <Link href="/login" className="btn-ghost">
              Entrar
            </Link>
            <a
              href={urlWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary"
            >
              <span className="hidden sm:inline">Pedir demo</span>
              <span className="sm:hidden">Demo</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-20 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="animate-slide-up">
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-5"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                color: ACCENT_HEX,
              }}
            >
              <Sparkles className="w-3 h-3" />
              Asistente con IA · solo por WhatsApp
            </div>
            <h1 className="text-5xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text leading-[1.05]">
              <span style={{ color: ACCENT_HEX }}>Cero</span> apps.<br />
              <span style={{ color: ACCENT_HEX }}>Cero</span> comisiones.<br />
              <span style={{ color: ACCENT_HEX }}>Cero</span> esperas.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-text-muted leading-relaxed max-w-lg">
              Tus clientes piden por WhatsApp. Comandi entiende lo que escriben,
              organiza el pedido y te avisa. Una preocupación menos.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <a
                href={urlWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary w-full sm:w-auto"
              >
                Pedir demo por WhatsApp
                <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#como-funciona" className="btn-secondary w-full sm:w-auto">
                Ver cómo funciona
              </a>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-text-muted">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" style={{ color: ACCENT_HEX }} />
                Sin permanencia
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" style={{ color: ACCENT_HEX }} />
                Listo en 24h
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" style={{ color: ACCENT_HEX }} />
                Plan que crece contigo
              </div>
            </div>
          </div>

          <div className="animate-fade-in">
            <MockupChat />
          </div>
        </div>
      </section>

      {/* BANDA DE IMPACTO */}
      <BandaImpacto />

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
              Cómo funciona
            </h2>
            <p className="mt-3 text-text-muted">
              Del primer mensaje a tu cocina, en cuatro pasos automáticos. Sin instalar nada, sin formar a nadie.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <ViajePedido />
        </Reveal>
      </section>

      {/* MIRA COMANDI POR DENTRO */}
      <MiraPorDentro />

      {/* POR QUÉ COMANDI */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 relative">
        <div
          aria-hidden
          className="absolute top-1/2 left-[25%] -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.22) 0%, rgba(16, 185, 129, 0.06) 35%, transparent 70%)' }}
        />
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12 relative">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
              Por qué Comandi
            </h2>
            <p className="mt-3 text-text-muted">
              Todo lo que necesitas para vender más por WhatsApp, sin complicaciones ni letra pequeña.
            </p>
          </div>
        </Reveal>
        <StaggerChildren className="grid grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4" stagger={0.04}>
          <FeatureCard
            icono={Smartphone}
            titulo="Sin app para tu cliente"
            texto="WhatsApp ya lo tienen instalado. Cero fricción, cero curva de aprendizaje, cero quejas."
          />
          <FeatureCard
            icono={Zap}
            titulo="Sin comisión por pedido"
            texto="Pagas una cuota fija al mes. No nos llevamos un porcentaje de cada venta. El margen es tuyo."
          />
          <FeatureCard
            icono={Bot}
            titulo="Entiende como sea que escriban"
            texto="Faltas, abreviaturas, 'oye ponme también' en mitad de la conversación. La IA reinterpreta el pedido y suma lo nuevo."
          />
          <FeatureCard
            icono={Star}
            titulo="Reseñas automáticas"
            texto="Tras entregar, el bot pide al cliente que valore el pedido. Recibes feedback real sin tener que pedirlo tú."
          />
          <FeatureCard
            icono={Bell}
            titulo="Avisos automáticos"
            texto="Si editas un pedido, el cliente recibe el resumen actualizado en su WhatsApp. Sin llamadas confusas."
          />
          <FeatureCard
            icono={ShieldCheck}
            titulo="Datos seguros y RGPD"
            texto="Cada restaurante ve solo sus pedidos y sus clientes. Datos alojados en Europa. Cumplimos la normativa española y puedes exportar o borrar datos cuando quieras."
          />
          <FeatureCard
            icono={BarChart3}
            titulo="Analíticas de tu negocio"
            texto="Productos más vendidos y los que más facturan, ingresos por día, tendencias frente al periodo anterior y valoración media. Decisiones con datos reales de tu restaurante."
          />
          <FeatureCard
            icono={Gauge}
            titulo="Tu plan, sin sorpresas"
            texto="Ves tu consumo de pedidos en todo momento y te avisamos antes de pasarte del plan. Cuando te conviene subir, te lo decimos para que cada pedido te salga más barato."
          />
        </StaggerChildren>
      </section>

      {/* PARA QUIÉN */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Reveal>
        <div className="card p-8 sm:p-12 bg-gradient-to-br from-surface to-surface-2 border-border">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-text">
              Hecho para cualquier restaurante con pedidos por teléfono
            </h2>
            <p className="mt-3 text-text-muted">
              Si ya recibes pedidos por WhatsApp o llamada, Comandi te ahorra horas a la semana.
            </p>
            <div className="mt-7 flex flex-wrap gap-2 justify-center">
              {[
                'Pizzerías', 'Restaurantes chinos', 'Kebabs', 'Sushi',
                'Hamburgueserías', 'Bares con cocina', 'Comida casera', 'Para llevar',
                'Cafeterías', 'Asadores', 'Vegetarianos', 'Cocina fusión'
              ].map(tipo => (
                <span key={tipo} className="badge bg-surface text-text border border-border px-3 py-1">
                  {tipo}
                </span>
              ))}
            </div>
          </div>
        </div>
        </Reveal>
      </section>

      {/* PRECIO */}
      <section id="precio" className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 relative">
        <div
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.22) 0%, rgba(16, 185, 129, 0.06) 35%, transparent 70%)' }}
        />
        <Reveal>
          <div className="text-center mb-12 max-w-2xl mx-auto relative">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
              Precio claro. Crece a tu ritmo.
            </h2>
            <p className="mt-3 text-text-muted">
              Empieza por el plan básico. Cuando tu volumen lo justifique, te avisamos
              para pasar al siguiente y que cada pedido te salga más barato.
            </p>
          </div>
        </Reveal>

        <StaggerChildren className="grid md:grid-cols-3 gap-3 md:gap-5 mt-4 md:mt-6" stagger={0.06}>
          <PlanCard
            nombre="Básico"
            precio="99"
            pedidos="600"
            recomendado={false}
            features={[
              'Bot de WhatsApp con IA',
              'Panel completo de gestión',
              'Reseñas automáticas',
              'Aviso al cliente al editar pedido',
              '+0,20€ por pedido extra',
              'Soporte por WhatsApp'
            ]}
          />
          <PlanCard
            nombre="Pro"
            precio="149"
            pedidos="1.500"
            recomendado={true}
            features={[
              'Todo lo del Básico',
              'Más del doble de pedidos incluidos',
              'Coste por pedido más bajo',
              'Análisis mensual de crecimiento',
              '+0,12€ por pedido extra',
              'Soporte prioritario'
            ]}
          />
          <PlanCard
            nombre="Premium"
            precio="249"
            pedidos="3.500"
            recomendado={false}
            features={[
              'Todo lo del Pro',
              'Volumen alto sin sorpresas',
              'Coste por pedido mínimo',
              'Sesión de optimización trimestral',
              '+0,08€ por pedido extra',
              'Soporte prioritario'
            ]}
          />
        </StaggerChildren>

        {/* Implementación */}
        <Reveal>
        <div className="card p-6 mt-8 bg-gradient-to-br from-surface to-accent/5 border-accent/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-text mb-1">
                Implementación: 119€ una sola vez
              </h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Antes de arrancar, hacemos juntos la puesta en marcha: reuniones contigo
                para ajustar el bot a tu carta, tu tono y tus horarios, formación de tu equipo
                y todos los ajustes hasta que todo funcione exactamente a tu gusto.
                Una vez listo, solo pagas la mensualidad del plan que elijas.
              </p>
            </div>
          </div>
        </div>
        </Reveal>

        <p className="text-xs text-text-muted text-center mt-6">
          Precios con IVA incluido. Paga al año y ahorra un 10%.
          Sin permanencia: cambia de plan o date de baja cuando quieras.
        </p>
      </section>

      {/* PRÓXIMAMENTE */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 relative">
        <div
          aria-hidden
          className="absolute top-1/2 left-[75%] -translate-x-1/2 -translate-y-1/2 w-[900px] h-[700px] pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(16, 185, 129, 0.22) 0%, rgba(16, 185, 129, 0.06) 35%, transparent 70%)' }}
        />
        <Reveal>
          <div className="text-center max-w-2xl mx-auto mb-12 relative">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-4">
              <Sparkles className="w-3 h-3" />
              Próximamente
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
              Sigue creciendo con nosotros
            </h2>
            <p className="mt-3 text-text-muted">
              Lo que estamos cocinando para los próximos meses. Sin coste extra para los clientes actuales.
            </p>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 max-w-3xl mx-auto">
          <Reveal offset={0}>
            <div className="relative card p-5 md:p-6 border-dashed h-full">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <ImageIcon className="w-4 h-4 text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-text mb-1.5">Carta web con fotos y carrito</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                El bot enviará un enlace a una mini-web con tu carta ilustrada. El cliente añade al carrito,
                vuelve a WhatsApp con el pedido pre-rellenado, y confirma. Para los que prefieren ver fotos
                antes que escribir.
              </p>
            </div>
          </Reveal>
          <Reveal offset={0.06}>
            <div className="relative card p-5 md:p-6 border-dashed h-full">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
                <QrCode className="w-4 h-4 text-accent" />
              </div>
              <h3 className="text-sm font-semibold text-text mb-1.5">Pedidos en mesa con QR</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                La misma carta web vale para tus mesas. Cada mesa con su QR, el cliente pide desde su móvil,
                llega directo a tu panel. Sin pasar por WhatsApp, sin esperar al camarero.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20">
        <Reveal>
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
              Preguntas frecuentes
            </h2>
            <p className="mt-3 text-text-muted">
              Si te queda alguna otra, escríbenos por WhatsApp y te respondemos rápido.
            </p>
          </div>
        </Reveal>
        <StaggerChildren className="space-y-3" stagger={0.02}>
          <FAQItem
            pregunta="¿Necesito instalar algo en mi móvil o en el de mis clientes?"
            respuesta="No. El cliente usa el WhatsApp que ya tiene. Tú accedes al panel desde el navegador del móvil, tablet u ordenador. Sin apps, sin instalaciones, sin actualizaciones."
          />
          <FAQItem
            pregunta="¿Y si mi cliente escribe mal o se equivoca?"
            respuesta="Lo entiende igualmente. La IA está entrenada para faltas de ortografía, abreviaturas, frases largas y pedidos en mitad de una charla. Si dice 'oye y ponme también una coca cola' a mitad del pedido, lo añade automáticamente."
          />
          <FAQItem
            pregunta="¿Puedo cambiar la carta o los precios cuando quiera?"
            respuesta="Sí. Desde el panel modificas categorías, productos, descripciones, precios y disponibilidad. Los cambios se aplican al instante, sin esperas."
          />
          <FAQItem
            pregunta="¿Qué pasa si paso de los pedidos incluidos en mi plan?"
            respuesta="Los pedidos de más se cobran por unidad, y cuanto mayor es tu plan, más barato el extra: 0,20€ en Básico, 0,12€ en Pro y 0,08€ en Premium. Por ejemplo, en Básico (99€/mes hasta 600 pedidos), si haces 700 pedidos serían 99€ + (100 × 0,20€) = 119€. En tu panel ves tu consumo en todo momento y te avisamos antes de pasarte, para que pases al plan que te salga más a cuenta."
          />
          <FAQItem
            pregunta="¿Puedo subir o bajar de plan cuando quiera?"
            respuesta="Sí. Cada mes analizamos tu volumen y te avisamos si te conviene cambiar. Tú decides. Sin papeleo, sin penalizaciones, sin permanencia."
          />
          <FAQItem
            pregunta="¿Qué incluye la implementación y cuándo se paga?"
            respuesta="Reuniones contigo para entender tu carta y tu manera de trabajar, configuración del bot a tu tono y horarios, formación de tu equipo en el panel, y todos los ajustes que necesites hasta que todo funcione perfecto. Coste único de 119€ que pagas al inicio, antes de empezar. A partir de ahí solo pagas la mensualidad del plan elegido."
          />
          <FAQItem
            pregunta="¿Cómo se contrata y cómo se paga?"
            respuesta="Escríbenos por WhatsApp para activarlo. Configuramos tu carta en 24h. Se factura mensualmente. Si en algún momento quieres darte de baja, lo haces y no pagas más."
          />
          <FAQItem
            pregunta="¿Quién es dueño de los datos de mis clientes?"
            respuesta="Tú. Cada restaurante ve solo sus pedidos y sus clientes. Cumplimos el RGPD: los datos están en servidores europeos y los puedes exportar o borrar cuando quieras."
          />
          <FAQItem
            pregunta="¿Funciona con cualquier número de WhatsApp?"
            respuesta="Para empezar te asignamos un número español dedicado para tu restaurante. Si más adelante quieres usar el tuyo propio, también se puede (requiere un trámite con WhatsApp Business)."
          />
        </StaggerChildren>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-24">
        <Reveal>
        <div className="card p-8 sm:p-12 relative overflow-hidden text-center">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl -z-0" />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
              ¿Listo para que tu WhatsApp trabaje por ti?
            </h2>
            <p className="mt-4 text-text-muted max-w-xl mx-auto">
              Escríbenos y en 24 horas tienes Comandi funcionando en tu restaurante.
              Cero compromiso, te explicamos todo en una llamada o por WhatsApp.
            </p>
            <a
              href={urlWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-7 text-base px-6 py-3"
            >
              Hablar con nosotros
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
                >
                  <MessageSquare className="w-3.5 h-3.5" strokeWidth={2.5} style={{ color: ACCENT_HEX }} />
                </div>
                <span className="text-sm font-semibold text-text">Comandi</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                Comandi — SCD TECH SL<br />
                NIF [NIF/CIF]<br />
                [DIRECCIÓN FISCAL]<br />
                Córdoba, España
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-2 text-xs">
              <Link href="/contacto" className="text-text-muted hover:text-text transition-colors">Contacto</Link>
              <Link href="/aviso-legal" className="text-text-muted hover:text-text transition-colors">Aviso legal</Link>
              <Link href="/privacidad" className="text-text-muted hover:text-text transition-colors">Política de privacidad</Link>
              <Link href="/login" className="text-text-muted hover:text-text transition-colors">Acceso clientes</Link>
            </div>
          </div>
          <div className="border-t border-border mt-8 pt-6 text-center text-xs text-text-muted">
            © {new Date().getFullYear()} Comandi. Todos los derechos reservados.
          </div>
        </div>
      </footer>
    </div>
  );
}

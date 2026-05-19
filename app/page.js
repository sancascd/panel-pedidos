'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare, Bot, LayoutDashboard, Check, Star, Bell,
  Smartphone, Zap, ShieldCheck, Sparkles, ArrowRight,
  ChevronDown, QrCode, Image as ImageIcon
} from 'lucide-react';

const WHATSAPP_VENTAS = '34685246694';
const MENSAJE_DEMO = 'Hola, me interesa Comandi para mi restaurante. ¿Podemos hablar?';

function urlWhatsApp() {
  return 'https://wa.me/' + WHATSAPP_VENTAS + '?text=' + encodeURIComponent(MENSAJE_DEMO);
}

function BurbujaUsuario({ children, hora }) {
  return (
    <div className="flex justify-end animate-slide-up">
      <div className="bg-emerald-100 dark:bg-emerald-900/40 rounded-2xl rounded-br-md px-3.5 py-2 max-w-[85%] shadow-sm">
        <div className="text-sm text-zinc-900 dark:text-zinc-100">{children}</div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-right mt-1">{hora} ✓✓</p>
      </div>
    </div>
  );
}

function BurbujaBot({ children, hora }) {
  return (
    <div className="flex justify-start animate-slide-up">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl rounded-bl-md px-3.5 py-2 max-w-[88%] shadow-sm">
        <div className="text-sm text-zinc-900 dark:text-zinc-100">{children}</div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 text-right mt-1">{hora}</p>
      </div>
    </div>
  );
}

function Escribiendo() {
  return (
    <div className="flex justify-start animate-fade-in">
      <div className="bg-white dark:bg-zinc-800 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
        <div className="flex gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
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
    <div className="relative">
      {/* Halo decorativo con respiración */}
      <div className="absolute -inset-10 bg-gradient-to-br from-accent/25 via-accent/8 to-transparent blur-3xl -z-10 animate-pulse-soft" />

      <div className="bg-surface border border-border rounded-3xl shadow-lift overflow-hidden max-w-md mx-auto">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-br from-emerald-700 to-emerald-800 flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center text-white text-sm font-bold shadow-soft">
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
        <div className="bg-zinc-50 dark:bg-zinc-900 p-4 space-y-2.5 h-[540px]">
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
    <div className="relative card p-6">
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
    <div className="card p-5">
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
    <div className={`relative card p-6 flex flex-col h-full ${
      recomendado ? 'border-accent ring-1 ring-accent shadow-lift' : ''
    }`}>
      {recomendado && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-accent text-white text-xs font-semibold whitespace-nowrap">
          Más popular
        </div>
      )}
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-text">{nombre}</h3>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-text tabular-nums">{precio}€</span>
          <span className="text-text-muted text-sm">/mes</span>
        </div>
        <p className="text-sm text-text-muted mt-1.5">
          Hasta <strong className="text-text tabular-nums">{pedidos}</strong> pedidos al mes
        </p>
      </div>

      <ul className="space-y-2.5 flex-1 mb-6">
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

export default function PaginaLanding() {
  // La landing siempre se ve en modo oscuro, sin importar la preferencia del usuario.
  // El panel sigue respetando el toggle claro/oscuro como hasta ahora.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const yaEraOscuro = document.documentElement.classList.contains('dark');
    if (!yaEraOscuro) {
      document.documentElement.classList.add('dark');
    }
    return () => {
      if (!yaEraOscuro) {
        document.documentElement.classList.remove('dark');
      }
    };
  }, []);

  return (
    <div className="dark min-h-screen bg-bg overflow-x-hidden">
      {/* Fondo decorativo del hero */}
      <div className="fixed inset-x-0 top-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-accent/8 blur-[120px]" />
      </div>

      {/* Header de la landing */}
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-accent" strokeWidth={2.5} />
            </div>
            <span className="text-base font-bold tracking-tight text-text">Comandi</span>
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
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-20 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium mb-5">
              <Sparkles className="w-3 h-3" />
              Asistente con IA · solo por WhatsApp
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text leading-[1.05]">
              <span className="text-accent">Cero</span> apps.<br />
              <span className="text-accent">Cero</span> comisiones.<br />
              <span className="text-accent">Cero</span> pedidos perdidos.
            </h1>
            <p className="mt-6 text-base sm:text-lg text-text-muted leading-relaxed max-w-lg">
              Tus clientes piden por WhatsApp como siempre. Comandi entiende lo que escriben,
              organiza el pedido y te avisa. Tú solo cocinas.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={urlWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary"
              >
                Pedir demo por WhatsApp
                <ArrowRight className="w-4 h-4" />
              </a>
              <a href="#como-funciona" className="btn-secondary">
                Ver cómo funciona
              </a>
            </div>
            <div className="mt-7 flex items-center gap-5 text-xs text-text-muted">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-accent" />
                Sin permanencia
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-accent" />
                Listo en 24h
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-accent" />
                Plan que crece contigo
              </div>
            </div>
          </div>

          <div className="animate-fade-in">
            <MockupChat />
          </div>
        </div>
      </section>

      {/* CÓMO FUNCIONA */}
      <section id="como-funciona" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
            Cómo funciona
          </h2>
          <p className="mt-3 text-text-muted">
            Tres pasos. Sin instalar nada en el móvil del cliente, sin formar a nadie.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          <PasoCard
            numero="1"
            icono={MessageSquare}
            titulo="Tu cliente escribe por WhatsApp"
            texto="Como siempre. Saluda, pide, pregunta — usa su WhatsApp normal. No descarga nada, no aprende ningún proceso nuevo."
          />
          <PasoCard
            numero="2"
            icono={Bot}
            titulo="La IA entiende el pedido"
            texto="Aunque escriba con faltas, mezcle productos en una frase o diga 'sin cebolla'. Pide los datos que faltan: dirección, pago, cambio."
          />
          <PasoCard
            numero="3"
            icono={LayoutDashboard}
            titulo="Tú lo gestionas en tu panel"
            texto="Un kanban claro con los pedidos del día. Imprimes comanda con un clic, marcas estados, editas si hace falta. El cliente recibe el aviso solo."
          />
        </div>
      </section>

      {/* POR QUÉ COMANDI */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 relative">
        <div aria-hidden className="absolute top-1/2 left-[25%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />
        <div className="text-center max-w-2xl mx-auto mb-12 relative">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
            Por qué Comandi
          </h2>
          <p className="mt-3 text-text-muted">
            Pensado para restaurantes españoles, no copiado de un SaaS de Silicon Valley.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            texto="Cada restaurante ve solo sus pedidos y sus clientes. Hosteado en Europa. Cumplimos la normativa española."
          />
        </div>
      </section>

      {/* PARA QUIÉN */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
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
      </section>

      {/* PRECIO */}
      <section id="precio" className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 relative">
        <div aria-hidden className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />
        <div className="text-center mb-12 max-w-2xl mx-auto relative">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
            Precio claro. Crece a tu ritmo.
          </h2>
          <p className="mt-3 text-text-muted">
            Empieza por el plan básico. Cuando tu volumen lo justifique, te avisamos
            para pasar al siguiente y que cada pedido te salga más barato.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 mt-6">
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
              '+0,12€ por pedido extra',
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
              '+0,12€ por pedido extra',
              'Soporte prioritario'
            ]}
          />
        </div>

        {/* Implementación */}
        <div className="card p-6 mt-8 bg-gradient-to-br from-surface to-accent/5 border-accent/20">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-text mb-1">
                Implementación: 99€ una sola vez
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

        <p className="text-xs text-text-muted text-center mt-6">
          Sin permanencia. Cambia de plan o date de baja cuando quieras.
        </p>
      </section>

      {/* PRÓXIMAMENTE */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 relative">
        <div aria-hidden className="absolute top-1/2 left-[75%] -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] rounded-full bg-accent/10 blur-[120px] pointer-events-none" />
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
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="card p-6 border-dashed">
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
          <div className="card p-6 border-dashed">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center mb-3">
              <QrCode className="w-4 h-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-text mb-1.5">Pedidos en mesa con QR</h3>
            <p className="text-sm text-text-muted leading-relaxed">
              La misma carta web vale para tus mesas. Cada mesa con su QR, el cliente pide desde su móvil,
              llega directo a tu panel. Sin pasar por WhatsApp, sin esperar al camarero.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-text">
            Preguntas frecuentes
          </h2>
          <p className="mt-3 text-text-muted">
            Si te queda alguna otra, escríbenos por WhatsApp y te respondemos rápido.
          </p>
        </div>
        <div className="space-y-3">
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
            respuesta="Cada pedido adicional cuesta 0,12€. Por ejemplo, en el plan Básico (99€/mes hasta 600 pedidos), si haces 700 pedidos en un mes serían 99€ + (100 × 0,12€) = 111€. Si vemos que mes a mes te excedes, te avisamos para que pases al plan Pro o Premium y cada pedido te salga más barato."
          />
          <FAQItem
            pregunta="¿Puedo subir o bajar de plan cuando quiera?"
            respuesta="Sí. Cada mes analizamos tu volumen y te avisamos si te conviene cambiar. Tú decides. Sin papeleo, sin penalizaciones, sin permanencia."
          />
          <FAQItem
            pregunta="¿Qué incluye la implementación y cuándo se paga?"
            respuesta="Reuniones contigo para entender tu carta y tu manera de trabajar, configuración del bot a tu tono y horarios, formación de tu equipo en el panel, y todos los ajustes que necesites hasta que todo funcione perfecto. Coste único de 99€ que pagas al inicio, antes de empezar. A partir de ahí solo pagas la mensualidad del plan elegido."
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
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
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
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
              <MessageSquare className="w-3.5 h-3.5 text-accent" strokeWidth={2.5} />
            </div>
            <span className="text-sm font-semibold text-text">Comandi</span>
            <span className="text-xs text-text-muted ml-2">Hecho en Córdoba, España</span>
          </div>
          <div className="flex items-center gap-5 text-xs text-text-muted">
            <Link href="/login" className="hover:text-text transition-colors">Acceso clientes</Link>
            <a
              href={urlWhatsApp()}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text transition-colors"
            >
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

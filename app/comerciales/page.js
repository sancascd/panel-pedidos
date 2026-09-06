import Link from 'next/link';
import {
  MessageSquare, ArrowLeft, Check, X, Store, Clock,
  Percent, Smartphone, Printer, MapPin,
} from 'lucide-react';

const ACCENT_HEX = '#10B981';

export const metadata = {
  title: 'Trabaja con Comandi — comerciales',
  description:
    'Comandi busca comerciales autónomos para presentar su servicio de pedidos por WhatsApp a restaurantes. Qué es, cómo funciona y por qué se vende.',
};

function Paso({ n, titulo, texto }) {
  return (
    <div className="flex gap-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 font-semibold text-sm tabular-nums"
        style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: ACCENT_HEX }}
      >
        {n}
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-text mb-1">{titulo}</h3>
        <p className="text-sm text-text-muted leading-relaxed">{texto}</p>
      </div>
    </div>
  );
}

function Argumento({ icono: Icono, titulo, texto }) {
  return (
    <div className="card p-5">
      <Icono className="w-5 h-5 mb-3" style={{ color: ACCENT_HEX }} />
      <h3 className="font-semibold text-text mb-1.5">{titulo}</h3>
      <p className="text-sm text-text-muted leading-relaxed">{texto}</p>
    </div>
  );
}

export default function Comerciales() {
  return (
    <div className="min-h-screen bg-bg">
      <style>{`
        @media print {
          @page { margin: 16mm; }
          .no-imprimir { display: none !important; }
          .card { border: 1px solid #ddd !important; box-shadow: none !important; break-inside: avoid; }
          section { break-inside: avoid; }
          a { text-decoration: none !important; color: inherit !important; }
        }
      `}</style>

      <header className="border-b border-border no-imprimir">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
            >
              <MessageSquare className="w-3.5 h-3.5" strokeWidth={2.5} style={{ color: ACCENT_HEX }} />
            </div>
            <span className="text-sm font-semibold text-text">Comandi</span>
          </Link>
          <Link href="/" className="text-sm text-text-muted hover:text-text transition-colors inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" />
            Volver
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-14">

        <section>
          <p className="text-xs font-semibold tracking-[0.18em] uppercase mb-3" style={{ color: ACCENT_HEX }}>
            Colabora con nosotros
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-4" style={{ textWrap: 'balance' }}>
            Presenta Comandi a los restaurantes de tu zona
          </h1>
          <p className="text-lg text-text-muted leading-relaxed">
            Buscamos comerciales autónomos que quieran llevar Comandi a bares y
            restaurantes. Trabajas por tu cuenta, a tu ritmo, y cobras por cada
            restaurante que se da de alta.
          </p>
          <p className="text-sm text-text-muted leading-relaxed mt-4">
            Esta página explica qué es el producto y por qué se vende. Las condiciones
            económicas las hablamos en persona.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-4">Qué es Comandi</h2>
          <p className="text-text-muted leading-relaxed mb-4">
            Un asistente que atiende el WhatsApp del restaurante y toma los pedidos solo.
            El cliente escribe como escribiría a un amigo, y el restaurante ve el pedido
            ordenado en una pantalla, listo para cocinar.
          </p>
          <p className="text-text-muted leading-relaxed">
            No es una app que haya que descargar, ni un portal donde el restaurante
            compite con otros. Es <strong className="text-text">su</strong> número de
            WhatsApp, con <strong className="text-text">sus</strong> clientes.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-6">Cómo funciona</h2>
          <div className="space-y-6">
            <Paso
              n="1"
              titulo="El cliente escribe al WhatsApp del restaurante"
              texto="Puede escribir su pedido con sus palabras, o abrir la carta y montarlo pulsando en los platos. El asistente le pregunta si es para recoger o a domicilio, la dirección y cómo va a pagar."
            />
            <Paso
              n="2"
              titulo="El pedido aparece en el panel"
              texto="Con un aviso sonoro, en un tablero separado por recogida y reparto. Si el restaurante tiene impresora, el ticket sale solo: uno para cocina y otro para grapar en la bolsa."
            />
            <Paso
              n="3"
              titulo="El restaurante cocina y avisa"
              texto="Cuando el pedido está listo o sale de reparto, el cliente recibe el aviso en su WhatsApp. Después se le puede pedir una reseña automáticamente."
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-2">Por qué se vende</h2>
          <p className="text-text-muted leading-relaxed mb-6">
            Estos son los argumentos que funcionan en la puerta de un restaurante.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <Argumento
              icono={Percent}
              titulo="Cero comisión por pedido"
              texto="Las plataformas de reparto se quedan entre un 20% y un 30% de cada pedido. Comandi es una cuota fija al mes: el margen se lo queda el restaurante."
            />
            <Argumento
              icono={Clock}
              titulo="Deja de sonar el teléfono"
              texto="En hora punta se pierden pedidos porque nadie puede cogerlo. El asistente atiende a varios clientes a la vez, sin equivocarse y sin poner a nadie en espera."
            />
            <Argumento
              icono={Smartphone}
              titulo="Sin apps ni aprender nada"
              texto="El cliente usa el WhatsApp que ya tiene. No hay que descargar nada, ni registrarse, ni recordar contraseñas. Funciona igual con un cliente de 20 años que de 70."
            />
            <Argumento
              icono={Printer}
              titulo="Los pedidos, por escrito"
              texto="Se acaban los malentendidos por teléfono y las direcciones apuntadas en una servilleta. Todo queda registrado, con el histórico de cada cliente."
            />
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-4">A quién se lo vendes</h2>
          <p className="text-text-muted leading-relaxed mb-4">
            Restaurantes que ya trabajan con <strong className="text-text">reparto o
            recogida</strong> y cogen los pedidos por teléfono. Cuanto más volumen de
            pedidos y más caos en hora punta, más rápido lo entienden.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Comida asiática', 'Pizzerías', 'Kebabs', 'Hamburgueserías', 'Sushi', 'Comida casera', 'Poke y saludable', 'Arroces y paellas'].map(t => (
              <span key={t} className="text-sm px-3 py-1.5 rounded-full bg-surface-2 text-text-muted">
                {t}
              </span>
            ))}
          </div>
          <p className="text-sm text-text-muted leading-relaxed mt-5">
            No encaja bien en restaurantes que solo trabajan en sala, sin comida para
            llevar. Ahí es mejor no perder el tiempo.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-6">Cómo nos repartimos el trabajo</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Store className="w-4 h-4" style={{ color: ACCENT_HEX }} />
                <h3 className="font-semibold text-text">Tú</h3>
              </div>
              <ul className="space-y-2.5">
                {['Visitas restaurantes de tu zona', 'Les enseñas cómo funciona', 'Resuelves sus dudas y cierras la venta', 'Nos pasas el contacto y los datos'].map(t => (
                  <li key={t} className="flex items-start gap-2 text-sm text-text">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ACCENT_HEX }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4" style={{ color: ACCENT_HEX }} />
                <h3 className="font-semibold text-text">Nosotros</h3>
              </div>
              <ul className="space-y-2.5">
                {['Damos de alta su línea de WhatsApp', 'Cargamos su carta completa', 'Configuramos el asistente a su medida', 'Formamos a su equipo y damos soporte'].map(t => (
                  <li key={t} className="flex items-start gap-2 text-sm text-text">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: ACCENT_HEX }} />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="text-sm text-text-muted leading-relaxed mt-4">
            Tú vendes; de la puesta en marcha nos encargamos nosotros. No necesitas saber
            de informática.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-4">Ya está funcionando</h2>
          <div className="card p-5 flex items-start gap-3">
            <MapPin className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: ACCENT_HEX }} />
            <div>
              <p className="text-text font-medium">Restaurante Gran Muralla · Córdoba</p>
              <p className="text-sm text-text-muted leading-relaxed mt-1">
                Nuestro primer cliente recibe sus pedidos con Comandi. No vas a vender
                una promesa: puedes enseñar el producto funcionando de verdad.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-text mb-2">Lo que no debes prometer</h2>
          <p className="text-text-muted leading-relaxed mb-5">
            Preferimos perder una venta a firmar un cliente que esperaba otra cosa. Estas
            cuatro quedan fuera del servicio:
          </p>
          <ul className="space-y-3">
            {[
              ['No cobramos los pedidos', 'El cliente paga al restaurante en efectivo o con tarjeta, como siempre. Comandi no gestiona el dinero.'],
              ['No hacemos reparto', 'El restaurante sigue repartiendo con sus medios. No somos una plataforma de reparto.'],
              ['No nos conectamos a su TPV', 'Comandi funciona por su cuenta. No se integra con su caja ni con otros programas.'],
              ['La carta y los alérgenos los aporta él', 'Nosotros los cargamos, pero la información es suya y es su responsabilidad legal que sea correcta.'],
            ].map(([t, d]) => (
              <li key={t} className="flex items-start gap-3">
                <X className="w-4 h-4 mt-1 flex-shrink-0 text-red-500" />
                <div>
                  <p className="text-text font-medium">{t}</p>
                  <p className="text-sm text-text-muted leading-relaxed">{d}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-6 sm:p-8">
          <h2 className="text-xl font-semibold text-text mb-3">¿Te interesa?</h2>
          <p className="text-text-muted leading-relaxed mb-5">
            Escríbenos y quedamos. Te contamos las condiciones, resolvemos tus dudas y,
            si encaja, empiezas cuando quieras.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="mailto:info@comandi.es?subject=Quiero%20ser%20comercial%20de%20Comandi" className="btn-primary">
              Escríbenos
            </a>
            <Link href="/" className="btn-secondary no-imprimir">
              Ver el producto
            </Link>
          </div>
          <p className="text-xs text-text-muted mt-5">
            info@comandi.es · Comandi es una marca de SCD TECH SL (NIF B88886437), Córdoba.
          </p>
        </section>

      </main>

      <footer className="border-t border-border no-imprimir">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 text-center text-xs text-text-muted">
          © {new Date().getFullYear()} Comandi · SCD TECH SL
        </div>
      </footer>
    </div>
  );
}

import { Mail, MessageSquare, MapPin, ArrowRight } from 'lucide-react';

export const metadata = {
  title: 'Contacto — Comandi',
  description: 'Ponte en contacto con el equipo de Comandi.',
};

const WHATSAPP_VENTAS = '34685246694';
const MENSAJE_DEMO = 'Hola, me interesa Comandi para mi restaurante. ¿Podemos hablar?';
const ACCENT_HEX = '#10b981';

function urlWhatsApp() {
  return 'https://wa.me/' + WHATSAPP_VENTAS + '?text=' + encodeURIComponent(MENSAJE_DEMO);
}

export default function Contacto() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-2">Contacto</h1>
      <p className="text-base text-text-muted mb-10">
        ¿Tienes alguna pregunta o quieres probar Comandi en tu restaurante? Escríbenos por
        cualquiera de estos canales y te respondemos rápido.
      </p>

      <div className="space-y-4">
        {/* WhatsApp */}
        <a
          href={urlWhatsApp()}
          target="_blank"
          rel="noopener noreferrer"
          className="card p-5 sm:p-6 flex items-start gap-4 hover:border-accent/40 transition-colors group"
        >
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
          >
            <MessageSquare className="w-5 h-5" style={{ color: ACCENT_HEX }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text mb-1">WhatsApp</h2>
            <p className="text-sm text-text-muted">
              La forma más rápida. Hablamos directamente y te enseñamos una demo.
            </p>
            <p className="text-sm font-medium mt-2 tabular-nums" style={{ color: ACCENT_HEX }}>
              +34 685 246 694
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-text-muted group-hover:text-text transition-colors mt-2 flex-shrink-0" />
        </a>

        {/* Email */}
        <div className="card p-5 sm:p-6 flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
          >
            <Mail className="w-5 h-5" style={{ color: ACCENT_HEX }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text mb-1">Email</h2>
            <p className="text-sm text-text-muted">
              Para cuestiones que requieran adjuntos o más detalle.
            </p>
            <a
              href="mailto:info@comandi.es"
              className="text-sm font-medium mt-2 inline-block hover:underline"
              style={{ color: ACCENT_HEX }}
            >
              info@comandi.es
            </a>
          </div>
        </div>

        {/* Dirección */}
        <div className="card p-5 sm:p-6 flex items-start gap-4">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
          >
            <MapPin className="w-5 h-5" style={{ color: ACCENT_HEX }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text mb-1">Dirección</h2>
            <p className="text-sm text-text-muted">
              Comandi — [NOMBRE COMPLETO]<br />
              NIF [NIF]<br />
              [DIRECCIÓN FISCAL]<br />
              Córdoba, España
            </p>
          </div>
        </div>
      </div>

      <div className="mt-12 p-6 rounded-xl border border-border bg-surface">
        <h2 className="text-base font-semibold text-text mb-2">Horario de atención</h2>
        <p className="text-sm text-text-muted leading-relaxed">
          Lunes a viernes de 9:00 a 19:00 (hora peninsular española). Te respondemos lo más rápido
          que podemos, normalmente el mismo día. Por las noches y fines de semana puede tardar un
          poco más.
        </p>
      </div>
    </main>
  );
}

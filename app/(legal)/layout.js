import Link from 'next/link';
import { MessageSquare, ArrowRight } from 'lucide-react';

const WHATSAPP_VENTAS = '34685246694';
const MENSAJE_DEMO = 'Hola, me interesa Comandi para mi restaurante. ¿Podemos hablar?';
const ACCENT_HEX = '#10b981';

function urlWhatsApp() {
  return 'https://wa.me/' + WHATSAPP_VENTAS + '?text=' + encodeURIComponent(MENSAJE_DEMO);
}

const TEMA = {
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

export default function LegalLayout({ children }) {
  return (
    <div className="min-h-screen overflow-x-hidden flex flex-col" style={TEMA}>
      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
            >
              <MessageSquare className="w-4 h-4" strokeWidth={2.5} style={{ color: ACCENT_HEX }} />
            </div>
            <span className="text-base font-bold tracking-tight text-text">Comandi</span>
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
        </div>
      </header>

      <div className="flex-1">{children}</div>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid sm:grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
                >
                  <MessageSquare
                    className="w-3.5 h-3.5"
                    strokeWidth={2.5}
                    style={{ color: ACCENT_HEX }}
                  />
                </div>
                <span className="text-sm font-semibold text-text">Comandi</span>
              </div>
              <p className="text-xs text-text-muted leading-relaxed">
                SCD TECH SL<br />
                NIF [NIF/CIF]<br />
                [DIRECCIÓN FISCAL]<br />
                Córdoba, España
              </p>
            </div>
            <div className="flex flex-col sm:items-end gap-2 text-xs">
              <Link href="/contacto" className="text-text-muted hover:text-text transition-colors">
                Contacto
              </Link>
              <Link href="/aviso-legal" className="text-text-muted hover:text-text transition-colors">
                Aviso legal
              </Link>
              <Link href="/privacidad" className="text-text-muted hover:text-text transition-colors">
                Política de privacidad
              </Link>
              <Link href="/login" className="text-text-muted hover:text-text transition-colors">
                Acceso clientes
              </Link>
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

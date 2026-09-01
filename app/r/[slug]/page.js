import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';

// Refresca la carta cada 30s (ISR). El restaurante edita en el panel y se ve
// reflejado casi al instante, sin pegarle a la BD en cada visita.
export const revalidate = 30;

function clienteSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}

async function obtenerCarta(slug) {
  const { data, error } = await clienteSupabase().rpc('carta_publica', { p_slug: slug });
  if (error) {
    console.error('Error carta_publica:', error.message);
    return null;
  }
  return data; // { nombre, slug, whatsapp, categorias: [...] } | null
}

function formatoPrecio(precio) {
  const n = Number(precio);
  if (!isFinite(n)) return '';
  return n.toFixed(2).replace('.', ',') + ' €';
}

function enlaceWhatsapp(numero) {
  if (!numero) return null;
  const digitos = String(numero).replace(/\D/g, '');
  return digitos ? 'https://wa.me/' + digitos : null;
}

export async function generateMetadata({ params }) {
  const carta = await obtenerCarta(params.slug);
  if (!carta) return { title: 'Carta no encontrada' };
  return {
    title: 'Carta de ' + carta.nombre,
    description: 'Carta de ' + carta.nombre + '. Haz tu pedido por WhatsApp.',
    // Por defecto no indexamos las cartas de clientes en buscadores.
    robots: { index: false, follow: false },
  };
}

export default async function CartaPublica({ params }) {
  const carta = await obtenerCarta(params.slug);
  if (!carta) notFound();

  const categorias = (carta.categorias || []).filter(
    (c) => (c.productos || []).length > 0
  );
  const waUrl = enlaceWhatsapp(carta.whatsapp);

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-2">
            Carta
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {carta.nombre}
          </h1>
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full bg-accent text-white font-semibold text-sm shadow-card hover:bg-accent-hover transition-colors"
            >
              Pedir por WhatsApp
            </a>
          ) : null}
        </header>

        {categorias.length === 0 ? (
          <p className="text-center text-text-muted">
            La carta se está actualizando. Vuelve pronto.
          </p>
        ) : (
          <div className="space-y-10">
            {categorias.map((cat, i) => (
              <section key={i}>
                <h2 className="text-lg font-semibold text-accent border-b border-border pb-2 mb-4">
                  {cat.nombre}
                </h2>
                <ul className="space-y-4">
                  {cat.productos.map((prod, j) => (
                    <li key={j} className="flex items-baseline gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{prod.nombre}</p>
                        {prod.descripcion ? (
                          <p className="text-sm text-text-muted mt-0.5">
                            {prod.descripcion}
                          </p>
                        ) : null}
                      </div>
                      <div className="whitespace-nowrap font-semibold tabular-nums">
                        {formatoPrecio(prod.precio)}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <footer className="mt-14 pt-6 border-t border-border text-center">
          {waUrl ? (
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white font-semibold text-sm shadow-card hover:bg-accent-hover transition-colors"
            >
              Pedir por WhatsApp
            </a>
          ) : (
            <p className="text-sm text-text-muted">Para pedir, escríbenos por WhatsApp.</p>
          )}
          <a
            href="https://comandi.es"
            target="_blank"
            rel="noopener noreferrer"
            className="block mt-6 text-xs text-text-muted hover:text-accent transition-colors"
          >
            Carta servida por <span className="font-semibold">Comandi</span>
          </a>
        </footer>
      </div>
    </main>
  );
}

import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import MenuInteractivo from './MenuInteractivo';

// Igual que la carta: refresco cada 30s. El restaurante toca el menú en el
// panel y se ve casi al instante, sin pegarle a la BD en cada visita.
export const revalidate = 30;

function clienteSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } }
  );
}

async function obtenerMenus(slug) {
  const { data, error } = await clienteSupabase().rpc('menus_publicos', { p_slug: slug });
  if (error) {
    console.error('Error menus_publicos:', error.message);
    return null;
  }
  return data; // { nombre, slug, whatsapp, menus: [...] } | null
}

const DIAS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

// "de lunes a viernes" si son seguidos; si no, la lista tal cual.
function textoDias(dias) {
  const d = (dias || []).slice().sort((a, b) => a - b);
  if (d.length === 0 || d.length === 7) return null;
  const seguidos = d.every((n, i) => i === 0 || n === d[i - 1] + 1);
  if (seguidos && d.length > 2) return 'de ' + DIAS[d[0]] + ' a ' + DIAS[d[d.length - 1]];
  return d.map((n) => DIAS[n]).join(', ');
}

export async function generateMetadata({ params }) {
  const datos = await obtenerMenus(params.slug);
  if (!datos) return { title: 'Menús no encontrados' };
  return {
    title: 'Menús de ' + datos.nombre,
    description: 'Elige tu menú y pídelo por WhatsApp.',
    robots: { index: false, follow: false },
  };
}

export default async function MenusPublicos({ params }) {
  const datos = await obtenerMenus(params.slug);
  if (!datos) notFound();

  // Ojo con la diferencia, que no es la misma cosa:
  //  - Un menú SIN grupos es un menú cerrado: precio fijo y nada que elegir.
  //    Se pide tal cual y hay que enseñarlo. (Los menús para 2, 3, 4, 5 y 6
  //    personas de China Town desaparecían por caer en el filtro de abajo.)
  //  - Un menú CON grupos donde ninguno tiene opciones está a medio montar en
  //    el editor: ese sí se esconde, porque el cliente vería huecos vacíos.
  const menus = (datos.menus || [])
    .map((m) => {
      const declarados = (m.grupos || []).length;
      const grupos = (m.grupos || []).filter((g) => (g.opciones || []).length > 0);
      return { ...m, grupos, aMedias: declarados > 0 && grupos.length === 0 };
    })
    .filter((m) => !m.aMedias);

  return (
    <main className="min-h-screen bg-bg text-text">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pb-40">
        <header className="mb-8 text-center">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase text-accent mb-2">
            Menús
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">{datos.nombre}</h1>
          <p className="mt-3 text-sm text-text-muted">
            Elige un plato de cada grupo y te lo pasamos al WhatsApp ya escrito.
          </p>
        </header>

        {menus.length === 0 ? (
          <p className="text-center text-text-muted">
            Ahora mismo no hay menús disponibles.
          </p>
        ) : (
          <MenuInteractivo
            menus={menus}
            whatsapp={datos.whatsapp}
            textosDias={menus.map((m) => textoDias(m.dias_semana))}
            horarios={datos.horarios || []}
          />
        )}

        <footer className="mt-14 pt-6 border-t border-border text-center">
          <a
            href={'/r/' + params.slug}
            className="text-sm text-accent hover:text-accent-hover font-medium"
          >
            Ver la carta completa
          </a>
          <p className="mt-4 text-xs text-text-muted">
            Pedidos con <span className="font-semibold">Comandi</span>
          </p>
        </footer>
      </div>
    </main>
  );
}

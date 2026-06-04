// Proxy server-side hacia el bot. Mantiene el INTERNAL_API_KEY oculto
// (no se expone al navegador como hacía la versión con NEXT_PUBLIC_*).
//
// El cliente llama a:  /api/bot-proxy/notificar
// Reenviamos a:        ${BOT_URL}/notificar  con header X-API-Key.
//
// Capas de proteccion (defensa en profundidad):
//   1. Whitelist de paths (cualquier otro -> 404).
//   2. Validacion de sesion Supabase (si se puede leer la cookie).
//      Si NO se puede leer la cookie, NO bloqueamos - solo loggeamos.
//      La proteccion real esta en (3) y (4).
//   3. INTERNAL_API_KEY del bot (server-side env, nunca expuesta).
//   4. Rate limit por IP en el bot.

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const BOT_URL = process.env.BOT_URL || 'https://bot-pedidos-production-f2b2.up.railway.app';

const PATHS_PERMITIDOS = new Set([
  'notificar',
  'notificar-estado',
  'enviar-campana'
]);

// Devuelve el contexto de autorización del usuario autenticado:
// { ok, userId, restauranteId, esSuperadmin }. Deriva el restaurante del
// servidor (sesión), NO del body → base para que el bot autorice por recurso.
async function obtenerContexto() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        }
      }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return { ok: false };
    const { data: restId } = await supabase.rpc('mi_restaurante_id');
    const { data: admin } = await supabase.rpc('soy_superadmin');
    return { ok: true, userId: user.id, restauranteId: restId || null, esSuperadmin: admin === true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export async function POST(req, { params }) {
  const segmentos = params.path || [];
  const path = segmentos.join('/');

  if (!PATHS_PERMITIDOS.has(path)) {
    return NextResponse.json({ error: 'Path no permitido' }, { status: 404 });
  }

  // Autenticación + autorización: el usuario debe estar logueado y tener un
  // restaurante (o ser superadmin). Derivamos su restaurante_id del servidor.
  const ctx = await obtenerContexto();
  if (!ctx.ok) {
    return NextResponse.json({ error: 'Sesión requerida' }, { status: 401 });
  }
  if (!ctx.restauranteId && !ctx.esSuperadmin) {
    return NextResponse.json({ error: 'Sin restaurante asociado' }, { status: 403 });
  }

  const apiKey = process.env.INTERNAL_API_KEY;
  if (!apiKey) {
    console.log('[bot-proxy] INTERNAL_API_KEY no configurada en Vercel');
    return NextResponse.json({ error: 'Servicio mal configurado' }, { status: 500 });
  }

  let bodyTexto = '';
  try {
    bodyTexto = await req.text();
  } catch (e) {
    return NextResponse.json({ error: 'Body invalido' }, { status: 400 });
  }

  let respuestaBot;
  try {
    respuestaBot = await fetch(`${BOT_URL}/${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': req.headers.get('content-type') || 'application/json',
        'X-API-Key': apiKey,
        // Contexto de autorización inyectado de forma fiable (server-side).
        // El bot confía en estos headers porque vienen con la INTERNAL_API_KEY.
        'X-Restaurante-Id': ctx.restauranteId || '',
        'X-Es-Superadmin': ctx.esSuperadmin ? 'true' : 'false'
      },
      body: bodyTexto
    });
  } catch (e) {
    console.log('[bot-proxy] error de red al bot:', e.message);
    return NextResponse.json({ error: 'Bot no responde' }, { status: 502 });
  }

  const contentType = respuestaBot.headers.get('content-type') || 'application/json';
  const textoRespuesta = await respuestaBot.text();
  return new NextResponse(textoRespuesta, {
    status: respuestaBot.status,
    headers: { 'Content-Type': contentType }
  });
}

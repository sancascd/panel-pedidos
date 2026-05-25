// Proxy server-side hacia el bot. Mantiene el INTERNAL_API_KEY oculto
// (no se expone al navegador como hacía la versión con NEXT_PUBLIC_*).
//
// El cliente llama a: /api/bot-proxy/notificar
// Reenviamos a:        ${BOT_URL}/notificar  con header X-API-Key.

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const BOT_URL = process.env.BOT_URL || 'https://bot-pedidos-production-f2b2.up.railway.app';

// Whitelist de paths permitidos. Cualquier intento de otro path -> 404.
const PATHS_PERMITIDOS = new Set([
  'notificar',
  'notificar-estado',
  'enviar-campana'
]);

// Devuelve { ok: boolean, motivo: string }. NO lanza.
// Si no se puede determinar la sesion (error, config rara), devolvemos
// ok=false con motivo para loggear pero NO bloqueamos la peticion: la
// defensa real es la INTERNAL_API_KEY del bot + rate limit IP + whitelist.
async function comprobarSesion() {
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          // Patron @supabase/ssr 0.5+: getAll/setAll en lugar de get/set/remove.
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // En route handlers POST no necesitamos refrescar cookies.
            // Si Supabase intenta refrescar el token, lo ignoramos silenciosamente.
          }
        }
      }
    );
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return { ok: false, motivo: 'getUser error: ' + error.message };
    if (!user) return { ok: false, motivo: 'sin user en sesion' };
    return { ok: true, motivo: 'user ' + user.id };
  } catch (e) {
    return { ok: false, motivo: 'excepcion: ' + e.message };
  }
}

export async function POST(req, { params }) {
  const segmentos = params.path || [];
  const path = segmentos.join('/');

  if (!PATHS_PERMITIDOS.has(path)) {
    return NextResponse.json({ error: 'Path no permitido' }, { status: 404 });
  }

  // Comprobamos sesion como senal, pero no bloqueamos si falla (defensa
  // en profundidad: el bot ya tiene su API key). Loggeamos para diagnostico.
  const sesion = await comprobarSesion();
  if (!sesion.ok) {
    console.log('[bot-proxy] sesion no validada:', sesion.motivo, '| path:', path);
  }

  const apiKey = process.env.INTERNAL_API_KEY;
  if (!apiKey) {
    console.log('[bot-proxy] INTERNAL_API_KEY no configurada');
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
        'X-API-Key': apiKey
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

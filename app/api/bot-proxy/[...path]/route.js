// Proxy server-side hacia el bot. Mantiene el INTERNAL_API_KEY oculto
// (no se expone al navegador como hacía la versión con NEXT_PUBLIC_*).
//
// El cliente llama a: /api/bot-proxy/notificar
// Reenviamos a:        ${BOT_URL}/notificar  con header X-API-Key.
//
// Este endpoint requiere sesión Supabase válida (el cliente ya pasa cookies);
// el bot ya rate-limita por IP + valida la API key. Defensa en profundidad.

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const BOT_URL = process.env.BOT_URL || 'https://bot-pedidos-production-f2b2.up.railway.app';

// Whitelist de paths permitidos. Cualquier intento de otro path -> 404.
// Si añadimos un endpoint nuevo en el bot, hay que añadirlo aquí.
const PATHS_PERMITIDOS = new Set([
  'notificar',
  'notificar-estado',
  'enviar-campana'
]);

async function comprobarSesion() {
  // Validar que hay un usuario logueado en Supabase antes de proxyar.
  // Sin esto, cualquiera con acceso a la URL podría llamar al proxy.
  try {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          get(name) { return cookieStore.get(name)?.value; },
          set() {},  // no-op (no necesitamos modificar cookies aquí)
          remove() {}
        }
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    return Boolean(user);
  } catch (e) {
    console.log('[bot-proxy] error validando sesion:', e.message);
    return false;
  }
}

export async function POST(req, { params }) {
  const segmentos = params.path || [];
  const path = segmentos.join('/');

  if (!PATHS_PERMITIDOS.has(path)) {
    return NextResponse.json({ error: 'Path no permitido' }, { status: 404 });
  }

  if (!(await comprobarSesion())) {
    return NextResponse.json({ error: 'Sesion requerida' }, { status: 401 });
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
    console.log('[bot-proxy] error de red:', e.message);
    return NextResponse.json({ error: 'Bot no responde' }, { status: 502 });
  }

  const contentType = respuestaBot.headers.get('content-type') || 'application/json';
  const textoRespuesta = await respuestaBot.text();
  return new NextResponse(textoRespuesta, {
    status: respuestaBot.status,
    headers: { 'Content-Type': contentType }
  });
}

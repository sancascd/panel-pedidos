'use client';

// Panel del comercial. Registra los restaurantes que va a visitar, comprueba
// si estan libres y sigue su estado.
//
// PRIVACIDAD: aqui solo se ven los contactos PROPIOS. Para saber si un
// restaurante lo tiene otro se usa la RPC comprobar_restaurante(), que
// responde libre/reservado/cliente sin revelar de quien es ni sus datos.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';
import BotonTema from '@/components/BotonTema';
import MenuNav from '@/components/MenuNav';
import {
  MessageSquare, Search, Plus, Loader2, Check, X, LogOut,
  Trophy, MapPin, Phone, AlertCircle, CheckCircle2, FileText,
} from 'lucide-react';

const ACCENT_HEX = '#10B981';

const ESTADOS = {
  registrado: { label: 'Registrado', clase: 'bg-surface-2 text-text-muted' },
  visitado:   { label: 'Visitado',   clase: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  interesado: { label: 'Interesado', clase: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  cerrado:    { label: 'Cerrado',    clase: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  descartado: { label: 'Descartado', clase: 'bg-surface-2 text-text-muted line-through' },
};

function diasQueQuedan(reservadoHasta) {
  if (!reservadoHasta) return null;
  const ms = new Date(reservadoHasta).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

// Estados en los que el restaurante todavia se trabaja. Los otros dos
// (cerrado y descartado) ya no se visitan, asi que bajan al final.
const EN_MARCHA = ['registrado', 'visitado', 'interesado'];
const SIN_POBLACION = 'Sin población';

// Agrupa por poblacion para poder recorrer una ciudad de una sentada, que es
// como se sale a visitar. Alfabetico, y los que no tienen poblacion al final:
// eso es un dato que falta, no un sitio al que ir.
function porPoblacion(lista) {
  const mapa = new Map();
  for (const c of lista) {
    const donde = (c.poblacion || '').trim() || SIN_POBLACION;
    if (!mapa.has(donde)) mapa.set(donde, []);
    mapa.get(donde).push(c);
  }
  return [...mapa.entries()].sort(([a], [b]) => {
    if (a === SIN_POBLACION) return 1;
    if (b === SIN_POBLACION) return -1;
    return a.localeCompare(b, 'es');
  });
}

// La lista de trabajo arriba, por ciudades; lo terminado abajo. Dentro de
// cerrados y descartados no hacen falta cabeceras de ciudad (no se visitan),
// pero se ordenan igual para que los del mismo sitio queden juntos.
function agruparContactos(contactos) {
  const porCiudad = (l) => porPoblacion(l).flatMap(([, cs]) => cs);
  return {
    ciudades:    porPoblacion(contactos.filter(c => EN_MARCHA.includes(c.estado))),
    cerrados:    porCiudad(contactos.filter(c => c.estado === 'cerrado')),
    descartados: porCiudad(contactos.filter(c => c.estado === 'descartado')),
  };
}

export default function PanelComercial() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [comercial, setComercial] = useState(null);
  const [contactos, setContactos] = useState([]);
  const [ranking, setRanking] = useState([]);

  const [nombre, setNombre] = useState('');
  const [poblacion, setPoblacion] = useState('');
  const [telefono, setTelefono] = useState('');
  const [comprobacion, setComprobacion] = useState(null); // {estado, dias_restantes}
  // Restaurantes ya registrados con un nombre parecido en la misma poblacion
  // ("Lin" y "Lin Wok"). Antes solo chocaban los iguales, y dos comerciales
  // podian acabar reservando el mismo sitio escrito de dos maneras.
  const [parecidos, setParecidos] = useState([]);
  const [esDistinto, setEsDistinto] = useState(false);
  const [comprobando, setComprobando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState({ texto: '', tipo: 'ok' });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: mio } = await supabase
        .from('comerciales')
        .select('id, nombre, activo')
        .eq('usuario_id', session.user.id)
        .maybeSingle();

      setComercial(mio || null);
      // Sin aprobar todavia: soy_comercial() es false, asi que no puede
      // consultar ni registrar nada. Se lo decimos claro.
      if (!mio || !mio.activo) { setCargando(false); return; }
      await Promise.all([cargarContactos(), cargarRanking()]);
      setCargando(false);
    }
    init();
  }, []);

  async function cargarContactos() {
    const { data } = await supabase
      .from('contactos_comerciales')
      .select('*')
      .order('registrado_en', { ascending: false });
    setContactos(data || []);
  }

  async function cargarRanking() {
    const { data } = await supabase.rpc('ranking_comerciales');
    setRanking(data || []);
  }

  function avisar(texto, tipo = 'ok') {
    setAviso({ texto, tipo });
    setTimeout(() => setAviso({ texto: '', tipo: 'ok' }), 6000);
  }

  async function comprobar() {
    if (!nombre.trim() || !poblacion.trim()) return;
    setComprobando(true);
    setComprobacion(null);
    setParecidos([]);
    setEsDistinto(false);
    const { data, error } = await supabase.rpc('comprobar_restaurante', {
      p_nombre: nombre.trim(),
      p_poblacion: poblacion.trim(),
    });
    if (error) { setComprobando(false); avisar('No se pudo comprobar: ' + error.message, 'error'); return; }
    const resultado = Array.isArray(data) ? data[0] : data;

    // Solo tiene sentido buscar parecidos si el nombre exacto esta libre: si
    // ya lo tiene alguien, eso manda y no hay nada que preguntar.
    if (resultado && resultado.estado === 'libre') {
      const { data: par, error: errPar } = await supabase.rpc('restaurantes_parecidos', {
        p_nombre: nombre.trim(),
        p_poblacion: poblacion.trim(),
      });
      if (!errPar) setParecidos(par || []);
    }
    setComprobando(false);
    setComprobacion(resultado);
  }

  async function registrar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    const { error } = await supabase.rpc('registrar_contacto', {
      p_nombre: nombre.trim(),
      p_poblacion: poblacion.trim(),
      p_telefono: telefono.trim() || null,
      p_es_distinto: esDistinto,
    });
    setGuardando(false);
    if (error) { avisar(error.message, 'error'); return; }
    avisar('Registrado. Lo tienes reservado 30 días.');
    setNombre(''); setPoblacion(''); setTelefono(''); setComprobacion(null);
    setParecidos([]); setEsDistinto(false);
    await Promise.all([cargarContactos(), cargarRanking()]);
  }

  async function borrar(contacto) {
    const ok = window.confirm(
      'Eliminar "' + contacto.nombre_restaurante + '" de tu lista?' +
      '\n\nQuedara libre para cualquiera.'
    );
    if (!ok) return;
    const { error } = await supabase.rpc('borrar_contacto', { p_id: contacto.id });
    if (error) { avisar(error.message, 'error'); return; }
    avisar('Eliminado.');
    await Promise.all([cargarContactos(), cargarRanking()]);
  }

  async function cambiarEstado(contacto, estado) {
    const { error } = await supabase.rpc('actualizar_contacto', {
      p_id: contacto.id,
      p_estado: estado,
    });
    if (error) { avisar(error.message, 'error'); return; }
    await Promise.all([cargarContactos(), cargarRanking()]);
  }

  async function salir() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  // Una ficha de restaurante. Se saca del JSX porque ahora se pinta desde
  // varios sitios: cada ciudad, los cerrados y los descartados.
  function tarjeta(c) {
    const dias = diasQueQuedan(c.reservado_hasta);
    const caducado = c.estado !== 'cerrado' && dias === 0;
    const est = ESTADOS[c.estado] || ESTADOS.registrado;
    return (
      <div key={c.id} className="card p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-medium text-text">{c.nombre_restaurante}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-muted flex-wrap">
              {c.poblacion && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{c.poblacion}
                </span>
              )}
              {c.telefono && (
                <a href={'tel:' + c.telefono} className="inline-flex items-center gap-1 hover:text-accent">
                  <Phone className="w-3 h-3" />{c.telefono}
                </a>
              )}
              {c.estado !== 'cerrado' && c.estado !== 'descartado' && (
                <span className={caducado ? 'text-red-500' : ''}>
                  {caducado ? 'Reserva caducada' : 'Reservado ' + dias + ' días más'}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span className={'badge text-xs px-2 py-1 rounded-md ' + est.clase}>{est.label}</span>
            {c.estado === 'cerrado' && (
              <span className={'text-xs ' + (c.comision_pagada_en ? 'text-accent' : 'text-text-muted')}>
                {c.comision_pagada_en ? 'Comisión pagada' : 'Comisión pendiente'}
              </span>
            )}
          </div>
        </div>

        {c.estado !== 'cerrado' && (
          <div className="flex gap-2 mt-3 pt-3 border-t border-border flex-wrap items-center">
            {c.estado === 'descartado' ? (
              <button onClick={() => cambiarEstado(c, 'registrado')} className="btn-ghost text-xs">
                Recuperar
              </button>
            ) : (
              <>
                {c.estado === 'registrado' && (
                  <button onClick={() => cambiarEstado(c, 'visitado')} className="btn-ghost text-xs">
                    Marcar visitado
                  </button>
                )}
                {c.estado !== 'interesado' && (
                  <button onClick={() => cambiarEstado(c, 'interesado')} className="btn-ghost text-xs">
                    Está interesado
                  </button>
                )}
                <button onClick={() => cambiarEstado(c, 'descartado')} className="btn-ghost text-xs">
                  Descartar
                </button>
              </>
            )}
            <button
              onClick={() => borrar(c)}
              className="btn-ghost text-xs ml-auto text-red-500 hover:text-red-600"
              title="Lo quita de tu lista y lo deja libre"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
    );
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT_HEX }} />
      </div>
    );
  }

  if (comercial && !comercial.activo) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-1">
          <Loader2 className="w-6 h-6" style={{ color: ACCENT_HEX }} />
        </div>
        <h1 className="text-xl font-semibold text-text">Tu solicitud está en revisión</h1>
        <p className="text-text-muted max-w-sm">
          Estamos revisando tu alta como comercial. En cuanto la aprobemos te avisamos
          por email y podrás empezar a registrar restaurantes.
        </p>
        <div className="flex gap-2 mt-3">
          <Link href="/comerciales" className="btn-secondary">Ver el material</Link>
          <button onClick={salir} className="btn-ghost">Cerrar sesión</button>
        </div>
      </div>
    );
  }

  if (!comercial) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <AlertCircle className="w-8 h-8 text-text-muted" />
        <p className="text-text">Tu cuenta no está dada de alta como comercial.</p>
        <p className="text-sm text-text-muted">Escríbenos a info@comandi.es y lo revisamos.</p>
        <button onClick={salir} className="btn-secondary mt-2">Cerrar sesión</button>
      </div>
    );
  }

  const cerrados = contactos.filter(c => c.estado === 'cerrado').length;
  const activos = contactos.filter(c => !['cerrado', 'descartado'].includes(c.estado)).length;
  const grupos = agruparContactos(contactos);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)' }}
            >
              <MessageSquare className="w-4 h-4" strokeWidth={2.5} style={{ color: ACCENT_HEX }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text truncate">{comercial.nombre}</p>
              <p className="text-xs text-text-muted">Comercial de Comandi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BotonTema />
            <MenuNav />
            <button onClick={salir} className="btn-ghost p-2.5" title="Cerrar sesión">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {aviso.texto && (
          <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm animate-fade-in ${
            aviso.tipo === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
              : 'bg-accent/10 border-accent/20 text-accent'
          }`}>
            {aviso.tipo === 'error'
              ? <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              : <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />}
            <span>{aviso.texto}</span>
          </div>
        )}

        {/* El dosier, a mano: es lo que se enseña en la visita, asi que no
            deberia haber que ir a buscarlo al desplegable. */}
        <a
          href="/material/comandi-como-funciona.pdf"
          target="_blank"
          rel="noopener noreferrer"
          className="card p-4 flex items-center gap-3 hover:border-accent transition-colors"
        >
          <FileText className="w-5 h-5 flex-shrink-0" style={{ color: ACCENT_HEX }} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-text">Material para el cliente</p>
            <p className="text-xs text-text-muted">
              El dosier de cómo funciona Comandi, para enseñar en la visita o mandarlo después.
            </p>
          </div>
        </a>

        {/* Registrar */}
        <section className="card p-5">
          <h2 className="font-semibold text-text mb-1">¿Vas a visitar un restaurante?</h2>
          <p className="text-sm text-text-muted mb-4">
            Compruébalo antes de ir. Si está libre y lo registras, te lo reservamos 30 días.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            <input
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setComprobacion(null); }}
              placeholder="Nombre del restaurante"
              className="input"
            />
            <input
              value={poblacion}
              onChange={(e) => { setPoblacion(e.target.value); setComprobacion(null); }}
              placeholder="Población"
              className="input"
            />
          </div>
          <p className="text-xs text-text-muted mt-2">
            La población es obligatoria: si hay dos restaurantes que se llaman igual, es lo que los distingue.
          </p>

          <button
            onClick={comprobar}
            disabled={!nombre.trim() || !poblacion.trim() || comprobando}
            className="btn-secondary w-full mt-3 disabled:opacity-50"
          >
            {comprobando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Comprobar si está libre
          </button>

          {comprobacion && (
            <div className="mt-4 animate-fade-in">
              {comprobacion.estado === 'libre' && parecidos.length > 0 && !esDistinto && (
                <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm">
                  <p className="font-semibold text-amber-700 dark:text-amber-400 mb-2">
                    Hay {parecidos.length === 1 ? 'un restaurante' : 'restaurantes'} con un nombre parecido en esa zona
                  </p>
                  <ul className="space-y-1 mb-3 text-text">
                    {parecidos.map((p, i) => (
                      <li key={i}>
                        <strong>{p.nombre}</strong>
                        {p.poblacion ? <span className="text-text-muted"> · {p.poblacion}</span> : null}
                        <span className="text-text-muted">
                          {' — '}
                          {p.estado === 'cliente' ? 'ya es cliente'
                            : p.estado === 'tuyo' ? 'lo tienes tú'
                            : 'lo tiene otro compañero'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-text mb-3">¿Es el mismo restaurante que &laquo;{nombre.trim()}&raquo;?</p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        setComprobacion(null); setParecidos([]);
                        avisar('Entonces ya está registrado, no hace falta que lo apuntes.');
                      }}
                      className="btn-secondary text-sm"
                    >
                      Sí, es el mismo
                    </button>
                    <button onClick={() => setEsDistinto(true)} className="btn-ghost text-sm">
                      No, es otro distinto
                    </button>
                  </div>
                </div>
              )}
              {comprobacion.estado === 'libre' && (parecidos.length === 0 || esDistinto) && (
                <>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm mb-3">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span>
                      <strong>Está libre.</strong> Puedes registrarlo.
                      {esDistinto && ' Quedará anotado que se parece a otro, por si hay que revisarlo.'}
                    </span>
                  </div>
                  <input
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    placeholder="Teléfono del restaurante (opcional)"
                    className="input mb-3"
                  />
                  <button onClick={registrar} disabled={guardando} className="btn-primary w-full disabled:opacity-50">
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Registrarlo a mi nombre
                  </button>
                </>
              )}
              {comprobacion.estado === 'reservado' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-sm">
                  <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Lo tiene otro compañero.</strong> Quedan {comprobacion.dias_restantes} días
                    de reserva. Si no lo cierra, volverá a quedar libre.
                  </span>
                </div>
              )}
              {comprobacion.estado === 'tuyo' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-2 border border-border text-text-muted text-sm">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Ya lo tienes tú registrado. Te quedan {comprobacion.dias_restantes} días.</span>
                </div>
              )}
              {comprobacion.estado === 'cliente' && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-2 border border-border text-text-muted text-sm">
                  <X className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>Ese restaurante ya es cliente de Comandi.</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Mis restaurantes */}
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-semibold text-text">Mis restaurantes</h2>
            <p className="text-sm text-text-muted tabular-nums">
              {activos} en marcha · {cerrados} cerrados
            </p>
          </div>

          {contactos.length === 0 ? (
            <div className="card p-8 text-center">
              <MapPin className="w-8 h-8 text-text-muted mx-auto mb-3 opacity-50" />
              <p className="text-text-muted">Todavía no has registrado ninguno.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {grupos.ciudades.map(([ciudad, lista]) => (
                <div key={ciudad}>
                  <div className="flex items-baseline gap-2 mb-2 px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">{ciudad}</h3>
                    <span className="text-xs text-text-muted tabular-nums">{lista.length}</span>
                  </div>
                  <div className="space-y-2">{lista.map(tarjeta)}</div>
                </div>
              ))}

              {grupos.cerrados.length > 0 && (
                <div>
                  <div className="flex items-baseline gap-2 mb-2 px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-accent">Cerrados</h3>
                    <span className="text-xs text-text-muted tabular-nums">{grupos.cerrados.length}</span>
                  </div>
                  <div className="space-y-2">{grupos.cerrados.map(tarjeta)}</div>
                </div>
              )}

              {grupos.descartados.length > 0 && (
                <div>
                  <div className="flex items-baseline gap-2 mb-2 px-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Descartados</h3>
                    <span className="text-xs text-text-muted tabular-nums">{grupos.descartados.length}</span>
                  </div>
                  <div className="space-y-2">{grupos.descartados.map(tarjeta)}</div>
                </div>
              )}
            </div>
          )}
          <p className="text-xs text-text-muted mt-3">
Cuando uno diga que sí, avísanos: el alta la confirmamos nosotros al firmar y
            cobrar. Ahí pasa a &laquo;Cerrado&raquo; y se te abona la comisión.
          </p>
        </section>

        {/* Ranking */}
        {ranking.length > 1 && (
          <section>
            <h2 className="font-semibold text-text mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4" style={{ color: ACCENT_HEX }} />
              Cómo va el equipo
            </h2>
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted text-left">
                    <th className="px-4 py-2.5 font-medium">Comercial</th>
                    <th className="px-4 py-2.5 font-medium text-right">Contactos</th>
                    <th className="px-4 py-2.5 font-medium text-right">Visitados</th>
                    <th className="px-4 py-2.5 font-medium text-right">Cerrados</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr
                      key={r.comercial_id}
                      className={'border-b border-border last:border-0 ' + (r.soy_yo ? 'bg-accent/5' : '')}
                    >
                      <td className="px-4 py-2.5 text-text">
                        <span className="text-text-muted tabular-nums mr-2">{i + 1}.</span>
                        {r.nombre}{r.soy_yo ? ' (tú)' : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">{r.contactos}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-text-muted">{r.visitados}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-text">{r.cerrados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <p className="text-center text-xs text-text-muted pt-2">
          <Link href="/comerciales" className="hover:text-accent">Material de venta</Link>
          {' · '}
          <a href="mailto:info@comandi.es" className="hover:text-accent">info@comandi.es</a>
        </p>
      </main>
    </div>
  );
}

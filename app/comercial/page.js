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
import {
  MessageSquare, Search, Plus, Loader2, Check, X, LogOut,
  Trophy, MapPin, Phone, AlertCircle, CheckCircle2,
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
  const [comprobando, setComprobando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState({ texto: '', tipo: 'ok' });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }

      const { data: mio } = await supabase
        .from('comerciales')
        .select('id, nombre')
        .eq('usuario_id', session.user.id)
        .maybeSingle();

      if (!mio) { setCargando(false); return; }
      setComercial(mio);
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
    if (!nombre.trim()) return;
    setComprobando(true);
    setComprobacion(null);
    const { data, error } = await supabase.rpc('comprobar_restaurante', {
      p_nombre: nombre.trim(),
      p_poblacion: poblacion.trim() || null,
    });
    setComprobando(false);
    if (error) { avisar('No se pudo comprobar: ' + error.message, 'error'); return; }
    setComprobacion(Array.isArray(data) ? data[0] : data);
  }

  async function registrar() {
    if (!nombre.trim()) return;
    setGuardando(true);
    const { error } = await supabase.rpc('registrar_contacto', {
      p_nombre: nombre.trim(),
      p_poblacion: poblacion.trim() || null,
      p_telefono: telefono.trim() || null,
    });
    setGuardando(false);
    if (error) { avisar(error.message, 'error'); return; }
    avisar('Registrado. Lo tienes reservado 30 días.');
    setNombre(''); setPoblacion(''); setTelefono(''); setComprobacion(null);
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

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: ACCENT_HEX }} />
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
              placeholder="Población (recomendado)"
              className="input"
            />
          </div>

          <button
            onClick={comprobar}
            disabled={!nombre.trim() || comprobando}
            className="btn-secondary w-full mt-3 disabled:opacity-50"
          >
            {comprobando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Comprobar si está libre
          </button>

          {comprobacion && (
            <div className="mt-4 animate-fade-in">
              {comprobacion.estado === 'libre' && (
                <>
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm mb-3">
                    <Check className="w-4 h-4 flex-shrink-0" />
                    <span><strong>Está libre.</strong> Puedes registrarlo.</span>
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
            <div className="space-y-2">
              {contactos.map(c => {
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
                      <span className={'badge text-xs px-2 py-1 rounded-md ' + est.clase}>{est.label}</span>
                    </div>

                    {c.estado !== 'cerrado' && c.estado !== 'descartado' && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-border flex-wrap">
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
                        <button onClick={() => cambiarEstado(c, 'descartado')} className="btn-ghost text-xs ml-auto">
                          Descartar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-xs text-text-muted mt-3">
            El alta la confirmamos nosotros cuando el restaurante firma y paga. Ahí pasa a
            &laquo;Cerrado&raquo; y se te abona la comisión.
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

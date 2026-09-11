'use client';

// Cómo va el equipo: el ranking de comerciales y las cifras de la red.
//
// Antes era una tabla al final de /comercial y se perdía. Ahora es una página
// del desplegable para los comerciales y la administradora.
//
// PRIVACIDAD: solo cifras (ranking_comerciales y estadisticas_equipo). Nunca
// se ve un restaurante de otro comercial; eso sigue siendo solo suyo.

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';
import MenuNav from '@/components/MenuNav';
import {
  ArrowLeft, Trophy, Users, Store, CheckCircle2, TrendingUp, MapPin, Loader2, AlertCircle,
} from 'lucide-react';

// Dos series en el gráfico semanal. Validados con el comprobador de paletas:
// en oscuro el verde de la marca queda fuera de banda y se usa uno más oscuro.
const BARRA_NUEVOS = 'bg-emerald-500 dark:bg-emerald-600';
const BARRA_CIERRES = 'bg-blue-500';

const pct = (n, total) => (total > 0 ? Math.round((n / total) * 100) : 0);

function fechaCorta(iso) {
  const [a, m, d] = String(iso).split('-').map(Number);
  return new Date(a, m - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
}

function Cifra({ icono: Icono, etiqueta, valor, detalle }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-text-muted mb-2">
        <Icono className="w-4 h-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{etiqueta}</span>
      </div>
      <p className="text-2xl font-bold text-text tabular-nums">{valor}</p>
      {detalle && <p className="text-xs text-text-muted mt-0.5">{detalle}</p>}
    </div>
  );
}

export default function PaginaEquipo() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [permitido, setPermitido] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [ranking, setRanking] = useState([]);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const [{ data: comercial }, { data: admin }] = await Promise.all([
        supabase.rpc('soy_comercial'), supabase.rpc('soy_superadmin'),
      ]);
      if (comercial !== true && admin !== true) { setPermitido(false); setCargando(false); return; }
      setEsAdmin(admin === true);
      const [r, e] = await Promise.all([
        supabase.rpc('ranking_comerciales'), supabase.rpc('estadisticas_equipo'),
      ]);
      // supabase.rpc() no lanza: el fallo viene en `error`.
      if (r.error || e.error) setError((r.error || e.error).message);
      setRanking(r.data || []);
      setDatos(e.data || null);
      setCargando(false);
    }
    init();
  }, []);

  if (cargando) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  if (!permitido) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg gap-3 px-6 text-center">
        <AlertCircle className="w-8 h-8 text-text-muted" />
        <p className="text-text">Esta página es para el equipo comercial.</p>
        <Link href="/" className="btn-secondary mt-2">Volver</Link>
      </div>
    );
  }

  const e = datos?.embudo || {};
  const registrados = Number(e.registrados || 0);
  const ciudades = datos?.ciudades || [];
  const semanas = datos?.semanas || [];
  const maxCiudad = Math.max(1, ...ciudades.map(c => c.contactos));
  const maxSemana = Math.max(1, ...semanas.map(s => Math.max(s.nuevos, s.cierres)));
  const nuevos8 = semanas.reduce((n, s) => n + s.nuevos, 0);
  const cierres8 = semanas.reduce((n, s) => n + s.cierres, 0);

  const embudo = [
    { etiqueta: 'Registrados', valor: registrados },
    { etiqueta: 'Visitados', valor: Number(e.visitados || 0) },
    { etiqueta: 'Interesados', valor: Number(e.interesados || 0) },
    { etiqueta: 'Cerrados', valor: Number(e.cerrados || 0) },
  ];

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-4 h-4 text-accent" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-text">Cómo va el equipo</h1>
              <p className="text-xs text-text-muted">La red comercial de Comandi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={esAdmin ? '/admin' : '/comercial'} className="btn-ghost">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </Link>
            <MenuNav />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg border text-sm bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>No se pudieron cargar las cifras: {error}</span>
          </div>
        )}

        {/* Lo principal, de un vistazo */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Cifra icono={Users} etiqueta="Comerciales" valor={datos?.comerciales ?? ranking.length} />
          <Cifra icono={Store} etiqueta="Registrados" valor={registrados}
                 detalle={e.nuevos_mes ? `+${e.nuevos_mes} este mes` : 'Ninguno este mes'} />
          <Cifra icono={CheckCircle2} etiqueta="Cerrados" valor={Number(e.cerrados || 0)}
                 detalle={e.cerrados_mes ? `+${e.cerrados_mes} este mes` : 'Ninguno este mes'} />
          <Cifra icono={TrendingUp} etiqueta="Tasa de cierre" valor={`${pct(Number(e.cerrados || 0), registrados)} %`}
                 detalle="de los registrados" />
        </div>

        {/* El embudo */}
        <section className="card p-5">
          <h2 className="font-semibold text-text mb-1">Del registro a la firma</h2>
          <p className="text-sm text-text-muted mb-4">Cuántos restaurantes llegan a cada paso. Cada barra, sobre el total registrado.</p>
          {registrados === 0 ? (
            <p className="text-sm text-text-muted">Todavía no hay restaurantes registrados.</p>
          ) : (
            <div className="space-y-3">
              {embudo.map(p => (
                <div key={p.etiqueta} className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-3"
                     title={`${p.etiqueta}: ${p.valor} de ${registrados} (${pct(p.valor, registrados)} %)`}>
                  <span className="text-sm text-text">{p.etiqueta}</span>
                  <div className="h-3 rounded-full bg-surface-2 overflow-hidden">
                    <div className={`h-full rounded-full ${BARRA_NUEVOS}`} style={{ width: `${pct(p.valor, registrados)}%` }} />
                  </div>
                  <span className="text-sm text-right tabular-nums">
                    <strong className="text-text">{p.valor}</strong>
                    <span className="text-text-muted"> · {pct(p.valor, registrados)} %</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Por ciudad */}
        <section className="card p-5">
          <h2 className="font-semibold text-text mb-1 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-accent" /> Por ciudad
          </h2>
          <p className="text-sm text-text-muted mb-4">Dónde se está trabajando y cuántos comerciales hay en cada sitio.</p>
          {ciudades.length === 0 ? (
            <p className="text-sm text-text-muted">Todavía no hay restaurantes registrados.</p>
          ) : (
            <div className="space-y-3">
              {ciudades.map(c => (
                <div key={c.poblacion} title={`${c.poblacion}: ${c.contactos} registrados, ${c.cerrados} cerrados, ${c.comerciales} comerciales`}>
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <span className="text-sm font-medium text-text truncate">{c.poblacion}</span>
                    <span className="text-xs text-text-muted tabular-nums flex-shrink-0">
                      {c.contactos} {c.contactos === 1 ? 'restaurante' : 'restaurantes'}
                      {c.cerrados > 0 && <> · <strong className="text-text">{c.cerrados} {c.cerrados === 1 ? 'cerrado' : 'cerrados'}</strong></>}
                      {' · '}{c.comerciales} {c.comerciales === 1 ? 'comercial' : 'comerciales'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
                    <div className={`h-full rounded-full ${BARRA_NUEVOS}`} style={{ width: `${(c.contactos / maxCiudad) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Las últimas 8 semanas */}
        <section className="card p-5">
          <h2 className="font-semibold text-text mb-1">Las últimas 8 semanas</h2>
          <p className="text-sm text-text-muted mb-3">
            {nuevos8} {nuevos8 === 1 ? 'restaurante registrado' : 'restaurantes registrados'} y {cierres8} {cierres8 === 1 ? 'cierre' : 'cierres'}.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
            <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${BARRA_NUEVOS}`} /> Registrados</span>
            <span className="flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${BARRA_CIERRES}`} /> Cierres</span>
          </div>
          <div className="flex items-end gap-2 sm:gap-3 h-32 border-b border-border">
            {semanas.map(s => (
              <div key={s.semana} className="flex-1 h-full flex items-end justify-center gap-0.5 group"
                   title={`Semana del ${fechaCorta(s.semana)}: ${s.nuevos} registrados, ${s.cierres} ${s.cierres === 1 ? 'cierre' : 'cierres'}`}>
                <div className={`w-2.5 sm:w-3.5 rounded-t ${BARRA_NUEVOS} group-hover:opacity-80`}
                     style={{ height: `${(s.nuevos / maxSemana) * 100}%`, minHeight: s.nuevos ? 3 : 0 }} />
                <div className={`w-2.5 sm:w-3.5 rounded-t ${BARRA_CIERRES} group-hover:opacity-80`}
                     style={{ height: `${(s.cierres / maxSemana) * 100}%`, minHeight: s.cierres ? 3 : 0 }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 sm:gap-3 mt-1.5">
            {semanas.map(s => (
              <span key={s.semana} className="flex-1 text-center text-[10px] sm:text-xs text-text-muted tabular-nums">
                {fechaCorta(s.semana)}
              </span>
            ))}
          </div>
        </section>

        {/* El ranking */}
        {ranking.length > 0 && (
          <section>
            <h2 className="font-semibold text-text mb-3 flex items-center gap-2">
              <Trophy className="w-4 h-4 text-accent" /> El ranking
            </h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-text-muted text-left">
                    <th className="px-4 py-2.5 font-medium">Comercial</th>
                    <th className="px-4 py-2.5 font-medium text-right">Registrados</th>
                    <th className="px-4 py-2.5 font-medium text-right">Visitados</th>
                    <th className="px-4 py-2.5 font-medium text-right">Cerrados</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((r, i) => (
                    <tr key={r.comercial_id}
                        className={'border-b border-border last:border-0 ' + (r.soy_yo ? 'bg-accent/5' : '')}>
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

        <p className="text-center text-xs text-text-muted">
          Aquí solo se ven cifras. Los restaurantes de cada comercial son solo suyos.
        </p>
      </main>
    </div>
  );
}

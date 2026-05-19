'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import { ArrowLeft, Star, Loader2, Filter } from 'lucide-react';

function estrellas(puntuacion) {
  const llenas = '★'.repeat(puntuacion);
  const vacias = '☆'.repeat(5 - puntuacion);
  return llenas + vacias;
}

function formatearFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function telefonoLimpio(tel) {
  if (!tel) return '';
  return tel.replace('whatsapp:', '').replace(/\s/g, '').trim();
}

export default function PaginaResenas() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [resenas, setResenas] = useState([]);
  const [filtro, setFiltro] = useState(0); // 0 = todas

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      await cargar();
      setCargando(false);
    }
    init();
  }, []);

  async function cargar() {
    const { data } = await supabase
      .from('resenas')
      .select('*')
      .order('creado_en', { ascending: false });
    setResenas(data || []);
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const total = resenas.length;
  const media = total > 0
    ? (resenas.reduce((s, r) => s + r.puntuacion, 0) / total)
    : 0;
  const filtradas = filtro === 0 ? resenas : resenas.filter(r => r.puntuacion === filtro);

  const distribucion = [5, 4, 3, 2, 1].map(p => ({
    puntuacion: p,
    cuenta: resenas.filter(r => r.puntuacion === p).length
  }));

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Star className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Reseñas</h1>
              <p className="text-xs text-text-muted hidden sm:block">Opiniones de tus clientes</p>
            </div>
          </div>
          <a href="/pedidos" className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {total === 0 ? (
          <div className="card p-6 text-center">
            <Star className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text font-medium mb-1">Aún no hay reseñas</p>
            <p className="text-sm text-text-muted">
              Cuando entregues pedidos, el bot pedirá automáticamente reseñas a tus clientes.
              Puedes activarlas o desactivarlas desde Ajustes.
            </p>
          </div>
        ) : (
          <>
            <div className="card p-6">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-center">
                  <p className="text-5xl font-bold text-text tabular-nums">{media.toFixed(1)}</p>
                  <p className="text-yellow-500 text-lg mt-1">{estrellas(Math.round(media))}</p>
                  <p className="text-xs text-text-muted mt-1">
                    {total} {total === 1 ? 'reseña' : 'reseñas'}
                  </p>
                </div>
                <div className="flex-1 min-w-[200px] space-y-1.5">
                  {distribucion.map(d => {
                    const porcentaje = total > 0 ? (d.cuenta / total) * 100 : 0;
                    return (
                      <div key={d.puntuacion} className="flex items-center gap-2 text-sm">
                        <span className="w-8 text-text-muted tabular-nums">{d.puntuacion}★</span>
                        <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                          <div className="h-full bg-yellow-500" style={{ width: porcentaje + '%' }} />
                        </div>
                        <span className="w-10 text-right text-text-muted tabular-nums">{d.cuenta}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Filter className="w-4 h-4 text-text-muted" />
              <button
                onClick={() => setFiltro(0)}
                className={`badge border ${
                  filtro === 0
                    ? 'bg-accent/10 text-accent border-accent/20'
                    : 'bg-surface-2 text-text-muted border-border hover:text-text'
                }`}
              >
                Todas
              </button>
              {[5, 4, 3, 2, 1].map(p => (
                <button
                  key={p}
                  onClick={() => setFiltro(p)}
                  className={`badge border ${
                    filtro === p
                      ? 'bg-accent/10 text-accent border-accent/20'
                      : 'bg-surface-2 text-text-muted border-border hover:text-text'
                  }`}
                >
                  {p}★
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filtradas.length === 0 ? (
                <div className="py-8 text-center text-text-muted text-sm">
                  No hay reseñas con ese filtro.
                </div>
              ) : (
                filtradas.map(r => (
                  <div key={r.id} className="card p-4 animate-fade-in">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <span className="text-yellow-500 text-lg tabular-nums">
                        {estrellas(r.puntuacion)}
                      </span>
                      <span className="text-xs text-text-muted tabular-nums">
                        {formatearFecha(r.creado_en)}
                      </span>
                    </div>
                    {r.comentario && (
                      <p className="text-sm text-text mb-2">{r.comentario}</p>
                    )}
                    <p className="text-xs text-text-muted tabular-nums">
                      Pedido #{r.pedido_id ? r.pedido_id.slice(-4).toUpperCase() : '----'}
                      {' · '}
                      {telefonoLimpio(r.cliente_telefono)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

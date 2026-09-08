'use client';

import { useState, useEffect } from 'react';
import { crearClienteSupabase } from '@/lib/supabase';
import { FASES, avance } from '@/lib/puestaEnMarcha';
import { Check, ChevronDown, ChevronRight, AlertTriangle, Loader2, Pencil } from 'lucide-react';

// La lista de alta de UN restaurante. Se despliega desde su ficha en /admin.
//
// Guarda al vuelo: en medio de una visita no se le da a "guardar", y perder lo
// tachado por cerrar la pestaña sería peor que no tenerlo.
export default function PuestaEnMarcha({ restauranteId, onCambio }) {
  const supabase = crearClienteSupabase();
  const [filas, setFilas] = useState(null);          // { paso: {hecho, nota} }
  const [fasesAbiertas, setFasesAbiertas] = useState({ antes: true });
  const [editandoNota, setEditandoNota] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error: err } = await supabase
        .from('puesta_en_marcha')
        .select('paso, hecho, nota')
        .eq('restaurante_id', restauranteId);
      if (!vivo) return;
      if (err) { setError(err.message); setFilas({}); return; }
      const mapa = {};
      (data || []).forEach((f) => { mapa[f.paso] = { hecho: f.hecho, nota: f.nota || '' }; });
      setFilas(mapa);
    })();
    return () => { vivo = false; };
  }, [restauranteId]);

  async function guardar(paso, cambios) {
    const previo = filas[paso] || { hecho: false, nota: '' };
    const nuevo = { ...previo, ...cambios };
    setFilas((f) => ({ ...f, [paso]: nuevo }));       // optimista
    setError('');

    const { error: err } = await supabase.from('puesta_en_marcha').upsert({
      restaurante_id: restauranteId,
      paso,
      hecho: nuevo.hecho,
      nota: nuevo.nota || null,
      actualizado_en: new Date().toISOString(),
    }, { onConflict: 'restaurante_id,paso' });

    if (err) {
      // Deshacer: si no, se queda tachado en pantalla y sin guardar, que es la
      // peor combinación posible en una lista de trabajo.
      setFilas((f) => ({ ...f, [paso]: previo }));
      setError('No se pudo guardar: ' + err.message);
      return;
    }
    if (onCambio) onCambio();
  }

  if (filas === null) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-text-muted">
        <Loader2 className="w-4 h-4 animate-spin" /> Cargando…
      </div>
    );
  }

  const hechos = Object.keys(filas).filter((p) => filas[p].hecho);
  const a = avance(hechos);

  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${a.completo ? 'bg-accent' : 'bg-accent/70'}`}
            style={{ width: (a.total ? (a.hechos / a.total) * 100 : 0) + '%' }}
          />
        </div>
        <span className="text-xs font-semibold tabular-nums text-text-muted shrink-0">
          {a.hechos}/{a.total}
        </span>
      </div>

      {a.criticosPendientes > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-3">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          Quedan {a.criticosPendientes} pasos que no se pueden saltar
        </p>
      )}

      {error && <p className="text-xs text-red-500 mb-2">{error}</p>}

      <div className="space-y-2">
        {FASES.map((fase) => {
          const abierta = fasesAbiertas[fase.id];
          const deFase = fase.pasos.filter((p) => filas[p.id]?.hecho).length;
          return (
            <div key={fase.id} className="rounded-lg border border-border overflow-hidden">
              <button
                onClick={() => setFasesAbiertas((f) => ({ ...f, [fase.id]: !f[fase.id] }))}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-2 transition-colors"
              >
                {abierta ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                <span className="text-sm font-semibold text-text flex-1">{fase.titulo}</span>
                <span className={`text-xs tabular-nums px-1.5 py-0.5 rounded-md ${
                  deFase === fase.pasos.length
                    ? 'bg-accent/15 text-accent'
                    : 'bg-surface-2 text-text-muted'
                }`}>
                  {deFase}/{fase.pasos.length}
                </span>
              </button>

              {abierta && (
                <ul className="px-3 pb-2.5 space-y-1 border-t border-border pt-2">
                  {fase.pasos.map((paso) => {
                    const est = filas[paso.id] || { hecho: false, nota: '' };
                    return (
                      <li key={paso.id}>
                        <div className="flex items-start gap-2.5">
                          <input
                            type="checkbox"
                            checked={est.hecho}
                            onChange={(e) => guardar(paso.id, { hecho: e.target.checked })}
                            className="mt-1 w-4 h-4 accent-[var(--accent,#10B981)] shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${est.hecho ? 'text-text-muted line-through' : 'text-text'}`}>
                              {paso.titulo}
                              {paso.critico && !est.hecho && (
                                <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400 no-underline">
                                  · no se puede saltar
                                </span>
                              )}
                            </p>
                            {paso.detalle && (
                              <p className="text-xs text-text-muted mt-0.5">{paso.detalle}</p>
                            )}

                            {editandoNota === paso.id ? (
                              <input
                                autoFocus
                                defaultValue={est.nota}
                                placeholder="Nota: qué quedó pendiente, un dato…"
                                className="input w-full mt-1.5 text-xs"
                                onBlur={(e) => {
                                  setEditandoNota(null);
                                  if (e.target.value !== est.nota) guardar(paso.id, { nota: e.target.value });
                                }}
                                onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                              />
                            ) : est.nota ? (
                              <button
                                onClick={() => setEditandoNota(paso.id)}
                                className="mt-1 text-xs text-left text-accent hover:underline"
                              >
                                {est.nota}
                              </button>
                            ) : (
                              <button
                                onClick={() => setEditandoNota(paso.id)}
                                className="mt-0.5 text-xs text-text-muted hover:text-accent inline-flex items-center gap-1"
                              >
                                <Pencil className="w-3 h-3" /> nota
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {a.completo && (
        <p className="flex items-center gap-1.5 text-sm text-accent font-semibold mt-3">
          <Check className="w-4 h-4" /> Puesta en marcha terminada
        </p>
      )}
    </div>
  );
}

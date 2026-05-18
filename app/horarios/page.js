'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import { ArrowLeft, Clock, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

const DIAS = [
  { num: 1, nombre: 'Lunes' },
  { num: 2, nombre: 'Martes' },
  { num: 3, nombre: 'Miércoles' },
  { num: 4, nombre: 'Jueves' },
  { num: 5, nombre: 'Viernes' },
  { num: 6, nombre: 'Sábado' },
  { num: 7, nombre: 'Domingo' },
];

export default function PaginaHorarios() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [restauranteId, setRestauranteId] = useState(null);
  const [horarios, setHorarios] = useState({});
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) { setCargando(false); return; }
      setRestauranteId(restId);
      await cargarHorarios(restId);
      setCargando(false);
    }
    init();
  }, []);

  async function cargarHorarios(restId) {
    const { data } = await supabase.from('horarios').select('*').eq('restaurante_id', restId);
    const map = {};
    DIAS.forEach(d => {
      const existente = (data || []).find(h => h.dia_semana === d.num);
      map[d.num] = existente || {
        dia_semana: d.num,
        cerrado: false,
        manana_apertura: '13:00',
        manana_cierre: '16:00',
        noche_apertura: '20:00',
        noche_cierre: '23:30',
      };
    });
    setHorarios(map);
  }

  function actualizarHorario(dia, campo, valor) {
    setHorarios(prev => ({
      ...prev,
      [dia]: { ...prev[dia], [campo]: valor }
    }));
  }

  async function guardar() {
    setGuardando(true);
    setMensaje('');
    try {
      for (const dia of DIAS) {
        const h = horarios[dia.num];
        const payload = {
          restaurante_id: restauranteId,
          dia_semana: dia.num,
          cerrado: h.cerrado,
          manana_apertura: h.cerrado ? null : (h.manana_apertura || null),
          manana_cierre: h.cerrado ? null : (h.manana_cierre || null),
          noche_apertura: h.cerrado ? null : (h.noche_apertura || null),
          noche_cierre: h.cerrado ? null : (h.noche_cierre || null),
        };
        await supabase.from('horarios').upsert(payload, { onConflict: 'restaurante_id,dia_semana' });
      }
      setMensaje('Horarios guardados correctamente.');
      setTimeout(() => setMensaje(''), 4000);
    } catch (e) {
      setMensaje('Error al guardar: ' + e.message);
    }
    setGuardando(false);
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Horarios</h1>
              <p className="text-xs text-text-muted hidden sm:block">Cuándo aceptas pedidos</p>
            </div>
          </div>
          <a href="/pedidos" className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        {mensaje && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm animate-fade-in">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{mensaje}</span>
          </div>
        )}

        <div className="card p-4 mb-4 flex items-start gap-3 bg-accent/5 border-accent/20">
          <AlertCircle className="w-5 h-5 text-accent mt-0.5 flex-shrink-0" />
          <div className="text-sm text-text">
            <p className="font-medium">Dos turnos por día</p>
            <p className="text-text-muted mt-0.5">
              Si solo tienes un turno (por ejemplo, solo cenas), deja en blanco el turno que no uses.
              Marca "Cerrado" si ese día no abres.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {DIAS.map(dia => {
            const h = horarios[dia.num] || {};
            return (
              <div key={dia.num} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-text">{dia.nombre}</h3>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={h.cerrado || false}
                      onChange={(e) => actualizarHorario(dia.num, 'cerrado', e.target.checked)}
                      className="w-4 h-4 accent-accent"
                    />
                    <span className="text-sm text-text">Cerrado</span>
                  </label>
                </div>

                {!h.cerrado && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-surface-2 rounded-lg p-3 border border-border">
                      <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">Mediodía</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={h.manana_apertura || ''}
                          onChange={(e) => actualizarHorario(dia.num, 'manana_apertura', e.target.value)}
                          className="input text-sm py-1.5"
                        />
                        <span className="text-text-muted">a</span>
                        <input
                          type="time"
                          value={h.manana_cierre || ''}
                          onChange={(e) => actualizarHorario(dia.num, 'manana_cierre', e.target.value)}
                          className="input text-sm py-1.5"
                        />
                      </div>
                    </div>

                    <div className="bg-surface-2 rounded-lg p-3 border border-border">
                      <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">Noche</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={h.noche_apertura || ''}
                          onChange={(e) => actualizarHorario(dia.num, 'noche_apertura', e.target.value)}
                          className="input text-sm py-1.5"
                        />
                        <span className="text-text-muted">a</span>
                        <input
                          type="time"
                          value={h.noche_cierre || ''}
                          onChange={(e) => actualizarHorario(dia.num, 'noche_cierre', e.target.value)}
                          className="input text-sm py-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="sticky bottom-4 mt-6">
          <button onClick={guardar} disabled={guardando} className="btn-primary w-full shadow-lift">
            {guardando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar horarios'
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

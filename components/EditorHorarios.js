'use client';

import { AlertCircle } from 'lucide-react';
import { DIAS, turnosQueNoCuadran } from '@/lib/horarios';

// Los turnos de cada día. Solo pinta y avisa: cargar y guardar lo hace
// quien lo usa (Ajustes), con lib/horarios.
export default function EditorHorarios({ horarios, onChange }) {
  function actualizar(dia, campo, valor) {
    onChange({ ...horarios, [dia]: { ...horarios[dia], [campo]: valor } });
  }
  const noCuadran = turnosQueNoCuadran(horarios);

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-muted">
        Dos turnos por día. Si solo tienes uno (por ejemplo, solo cenas), deja en blanco el que no uses.
        Marca «Cerrado» si ese día no abres.
      </p>

      {noCuadran.length > 0 && (
        <div className="flex items-start gap-2 p-3 rounded-lg border text-sm bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            {noCuadran.join(', ')}: un turno cierra a la misma hora o antes de abrir y el bot no aceptará pedidos en él.
            Si cierras a medianoche, pon <strong>23:59</strong> en vez de 00:00.
          </span>
        </div>
      )}

      {DIAS.map(dia => {
        const h = horarios[dia.num] || {};
        return (
          <div key={dia.num} className="rounded-lg border border-border p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text">{dia.nombre}</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={h.cerrado || false}
                  onChange={(e) => actualizar(dia.num, 'cerrado', e.target.checked)}
                  className="w-4 h-4 accent-accent"
                />
                <span className="text-sm text-text">Cerrado</span>
              </label>
            </div>

            {!h.cerrado && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[['Mediodía', 'manana'], ['Noche', 'noche']].map(([titulo, turno]) => (
                  <div key={turno} className="bg-surface-2 rounded-lg p-3 border border-border">
                    <p className="text-xs font-medium text-text-muted mb-2 uppercase tracking-wide">{titulo}</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={(h[turno + '_apertura'] || '').slice(0, 5)}
                        onChange={(e) => actualizar(dia.num, turno + '_apertura', e.target.value)}
                        className="input text-sm py-1.5"
                      />
                      <span className="text-text-muted">a</span>
                      <input
                        type="time"
                        value={(h[turno + '_cierre'] || '').slice(0, 5)}
                        onChange={(e) => actualizar(dia.num, turno + '_cierre', e.target.value)}
                        className="input text-sm py-1.5"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

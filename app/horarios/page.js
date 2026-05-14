'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';

// Nombres de los dias. El indice 0 no se usa (los dias van de 1 a 7).
const DIAS = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function PaginaHorarios() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [restauranteId, setRestauranteId] = useState(null);
  const [horarios, setHorarios] = useState([]); // array de 7 objetos, uno por dia
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) {
        setMensaje('No tienes ningún restaurante asignado.');
        setCargando(false);
        return;
      }
      setRestauranteId(restId);
      await cargarHorarios(restId);
      setCargando(false);
    }
    init();
  }, []);

  async function cargarHorarios(restId) {
    const { data } = await supabase
      .from('horarios')
      .select('*')
      .eq('restaurante_id', restId)
      .order('dia_semana', { ascending: true });

    // Construimos un array de 7 posiciones (dias 1-7).
    // Si falta algun dia en la BD, lo creamos vacio.
    const lista = [];
    for (let dia = 1; dia <= 7; dia++) {
      const existente = (data || []).find(h => h.dia_semana === dia);
      if (existente) {
        lista.push({
          dia_semana: dia,
          cerrado: existente.cerrado,
          manana_apertura: recortarHora(existente.manana_apertura),
          manana_cierre: recortarHora(existente.manana_cierre),
          noche_apertura: recortarHora(existente.noche_apertura),
          noche_cierre: recortarHora(existente.noche_cierre),
        });
      } else {
        lista.push({
          dia_semana: dia,
          cerrado: false,
          manana_apertura: '',
          manana_cierre: '',
          noche_apertura: '',
          noche_cierre: '',
        });
      }
    }
    setHorarios(lista);
  }

  // La BD devuelve la hora como "13:00:00", nos quedamos con "13:00"
  function recortarHora(hora) {
    if (!hora) return '';
    return hora.slice(0, 5);
  }

  // Actualiza un campo de un dia concreto
  function actualizar(diaIndex, campo, valor) {
    setHorarios(prev => {
      const copia = [...prev];
      copia[diaIndex] = { ...copia[diaIndex], [campo]: valor };
      return copia;
    });
  }

  function avisar(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3500);
  }

  async function guardarTodo() {
    setGuardando(true);

    // Preparamos las 7 filas para guardar
    const filas = horarios.map(h => ({
      restaurante_id: restauranteId,
      dia_semana: h.dia_semana,
      cerrado: h.cerrado,
      // Si un campo de hora esta vacio, guardamos null
      manana_apertura: h.manana_apertura || null,
      manana_cierre: h.manana_cierre || null,
      noche_apertura: h.noche_apertura || null,
      noche_cierre: h.noche_cierre || null,
    }));

    const { error } = await supabase
      .from('horarios')
      .upsert(filas, { onConflict: 'restaurante_id,dia_semana' });

    setGuardando(false);

    if (error) {
      avisar('Error al guardar: ' + error.message);
      return;
    }
    avisar('Horarios guardados correctamente');
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Cabecera */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">🕐 Horarios del restaurante</h1>
          <a href="/pedidos" className="text-sm text-blue-600 hover:underline">
            ← Volver a pedidos
          </a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">

        {mensaje && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-4">{mensaje}</div>
        )}

        <div className="bg-white rounded-lg shadow-sm p-5 mb-4">
          <p className="text-sm text-gray-600 mb-1">
            Configura los horarios de apertura. Puedes tener dos turnos al día (mañana y noche).
          </p>
          <p className="text-sm text-gray-500">
            Si un turno no se usa, déjalo vacío. Si un día cierras, marca la casilla "Cerrado".
          </p>
        </div>

        {/* Lista de dias */}
        <div className="space-y-3">
          {horarios.map((h, index) => (
            <div key={h.dia_semana} className="bg-white rounded-lg shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">{DIAS[h.dia_semana]}</h3>
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={h.cerrado}
                    onChange={(e) => actualizar(index, 'cerrado', e.target.checked)}
                    className="w-4 h-4"
                  />
                  Cerrado todo el día
                </label>
              </div>

              {!h.cerrado && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Turno de mañana */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">TURNO DE MAÑANA</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={h.manana_apertura}
                        onChange={(e) => actualizar(index, 'manana_apertura', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-gray-400">a</span>
                      <input
                        type="time"
                        value={h.manana_cierre}
                        onChange={(e) => actualizar(index, 'manana_cierre', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>

                  {/* Turno de noche */}
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">TURNO DE NOCHE</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={h.noche_apertura}
                        onChange={(e) => actualizar(index, 'noche_apertura', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-gray-400">a</span>
                      <input
                        type="time"
                        value={h.noche_cierre}
                        onChange={(e) => actualizar(index, 'noche_cierre', e.target.value)}
                        className="px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}

              {h.cerrado && (
                <p className="text-sm text-gray-400">Este día el restaurante permanece cerrado.</p>
              )}
            </div>
          ))}
        </div>

        {/* Boton guardar */}
        <div className="mt-6 sticky bottom-4">
          <button
            onClick={guardarTodo}
            disabled={guardando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-lg shadow-lg transition"
          >
            {guardando ? 'Guardando...' : 'Guardar horarios'}
          </button>
        </div>
      </main>
    </div>
  );
}

// Horarios del restaurante: leer y guardar. La pantalla está en Ajustes
// (components/EditorHorarios); /horarios solo redirige allí.

export const DIAS = [
  { num: 1, nombre: 'Lunes' },
  { num: 2, nombre: 'Martes' },
  { num: 3, nombre: 'Miércoles' },
  { num: 4, nombre: 'Jueves' },
  { num: 5, nombre: 'Viernes' },
  { num: 6, nombre: 'Sábado' },
  { num: 7, nombre: 'Domingo' },
];

// { 1: {dia_semana, cerrado, manana_apertura, ...}, ... } con valores por
// defecto para los días que aún no tienen fila.
export async function cargarHorarios(supabase, restauranteId) {
  const { data, error } = await supabase.from('horarios').select('*').eq('restaurante_id', restauranteId);
  if (error) throw new Error(error.message);
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
  return map;
}

// Lanza si algún día no se guarda (antes el error se perdía en silencio).
export async function guardarHorarios(supabase, restauranteId, horarios) {
  for (const dia of DIAS) {
    const h = horarios[dia.num];
    if (!h) continue;
    const { error } = await supabase.from('horarios').upsert({
      restaurante_id: restauranteId,
      dia_semana: dia.num,
      cerrado: h.cerrado,
      manana_apertura: h.cerrado ? null : (h.manana_apertura || null),
      manana_cierre: h.cerrado ? null : (h.manana_cierre || null),
      noche_apertura: h.cerrado ? null : (h.noche_apertura || null),
      noche_cierre: h.cerrado ? null : (h.noche_cierre || null),
    }, { onConflict: 'restaurante_id,dia_semana' });
    if (error) throw new Error(dia.nombre + ': ' + error.message);
  }
}

// El bot descarta un turno cuyo cierre no es posterior a la apertura (un
// cierre a las 00:00 pierde la noche entera). Devuelve los días con el problema.
export function turnosQueNoCuadran(horarios) {
  const mal = [];
  DIAS.forEach(d => {
    const h = horarios[d.num];
    if (!h || h.cerrado) return;
    for (const [ap, ci] of [[h.manana_apertura, h.manana_cierre], [h.noche_apertura, h.noche_cierre]]) {
      if (ap && ci && String(ci).slice(0, 5) <= String(ap).slice(0, 5)) { mal.push(d.nombre); break; }
    }
  });
  return mal;
}

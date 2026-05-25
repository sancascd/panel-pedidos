// Helpers de fechas para evitar bugs de timezone con timestamps de Supabase.
//
// PROBLEMA: Postgres a veces devuelve fechas como "2026-05-25 13:30:00+00"
// (con ESPACIO en vez de T entre fecha y hora). Algunos navegadores y entornos
// (sobre todo Safari) lo parsean como hora LOCAL en vez de UTC, lo que da un
// offset de varias horas.
//
// SOLUCION: normalizar el string a ISO 8601 estricto antes de pasarlo a Date.

export function parsearFechaUTC(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  let s = String(valor).trim();
  // Normalizar formato Postgres: "2026-05-25 13:30:00+00" -> "2026-05-25T13:30:00+00"
  s = s.replace(' ', 'T');
  // Si no tiene offset ni Z, asumir UTC explicitamente
  if (!/Z$/.test(s) && !/[+-]\d{2}:?\d{0,2}$/.test(s)) {
    s = s + 'Z';
  }
  // Postgres a veces devuelve "+00" sin minutos, normalizar a "+00:00"
  s = s.replace(/([+-]\d{2})$/, '$1:00');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Devuelve los minutos transcurridos desde una fecha (positivo).
// Defensive: si la fecha es null, futura, o muy lejana, devuelve 0.
export function minutosDesde(valorFecha) {
  const d = parsearFechaUTC(valorFecha);
  if (!d) return 0;
  const diff = Date.now() - d.getTime();
  // Diff negativo o mayor a 7 dias -> probablemente error, no contamos
  if (diff <= 0 || diff > 7 * 24 * 60 * 60 * 1000) return 0;
  return Math.floor(diff / 1000 / 60);
}

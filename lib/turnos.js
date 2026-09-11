// Turnos del restaurante, vistos desde el panel.
//
// Lo usa la impresion de los pedidos programados: un encargo no sale en papel
// cuando llega, sino al abrir el turno en el que cae. Uno pedido a mediodia
// para las 21:30 se imprime cuando abre la noche, que es cuando la cocina
// empieza a trabajarlo; si saliera a las 13:00, se pasaria la tarde en el rail.
//
// Pura y sin red: recibe la hora del encargo y los horarios (tabla `horarios`:
// dia_semana 1=lunes..7=domingo y los dos turnos manana/noche).

const DIA = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

// "12:00" o "12:00:00" -> minutos desde medianoche.
function aMinutos(hhmm) {
  if (!hhmm) return null;
  const m = String(hhmm).match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

// Dia de la semana y minuto del dia EN MADRID. Los horarios estan en hora
// local del restaurante; el encargo se guarda en UTC.
function enMadrid(fecha) {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(fecha);
  const v = (t) => (partes.find((p) => p.type === t) || {}).value;
  let h = Number(v('hour'));
  if (h === 24) h = 0;
  return { dia: DIA[v('weekday')], minuto: h * 60 + Number(v('minute')) };
}

// Hora a la que abre el turno en el que cae el encargo, o null si no se puede
// saber: sin horarios, dia cerrado, o la hora cae fuera de los dos turnos.
// Con null, quien llama imprime ya: mejor que salga pronto que no salga nunca.
//
// Un turno que cruza medianoche (cierre antes que apertura) se ignora, igual
// que en el bot, que lo descarta entero.
export function aperturaDelTurno(fecha, horarios) {
  if (!(fecha instanceof Date) || isNaN(fecha.getTime())) return null;
  const { dia, minuto } = enMadrid(fecha);
  const h = (horarios || []).find((x) => x.dia_semana === dia);
  if (!h || h.cerrado) return null;

  const turnos = [
    [h.manana_apertura, h.manana_cierre],
    [h.noche_apertura, h.noche_cierre],
  ];
  for (const [ap, ci] of turnos) {
    const a = aMinutos(ap);
    const c = aMinutos(ci);
    if (a == null || c == null || c <= a) continue;
    if (minuto >= a && minuto <= c) {
      // Se resta sobre la propia fecha del encargo: asi no hay que construir
      // "ese dia a esa hora en Madrid" a mano, que es donde se cuelan los
      // cambios de horario de verano.
      return new Date(fecha.getTime() - (minuto - a) * 60000);
    }
  }
  return null;
}

'use client';

import { useState } from 'react';

// Elegir el menú aquí en vez de por WhatsApp: se ve entero de un vistazo, se
// puede rectificar, cabe cualquier número de platos (WhatsApp solo pinta 10
// por lista) y cada plato admite su propia nota.
//
// El texto que se manda tiene que ser EXACTAMENTE el que entiende
// parsearMenuEstructurado() en el bot.
// En que turno estamos AHORA, en hora de Madrid. Sin esto la pagina enseñaba
// todos los menus a cualquier hora, aunque el menu dijera "solo a mediodia".
function momentoAhora(horarios) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const dias = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  let dia = 1, hh = 0, mm = 0;
  for (const p of f) {
    if (p.type === 'weekday') dia = dias[p.value] || 1;
    if (p.type === 'hour') hh = parseInt(p.value, 10);
    if (p.type === 'minute') mm = parseInt(p.value, 10);
  }
  const minutos = hh * 60 + mm;

  const h = (horarios || []).find((x) => x.dia_semana === dia);
  const aMin = (t) => {
    if (!t) return null;
    const [a, b] = String(t).split(':');
    return parseInt(a, 10) * 60 + parseInt(b, 10);
  };
  let turno = null;
  if (h && !h.cerrado) {
    const manana = [aMin(h.manana_apertura), aMin(h.manana_cierre)];
    const noche = [aMin(h.noche_apertura), aMin(h.noche_cierre)];
    if (manana[0] !== null && minutos >= manana[0] && minutos < manana[1]) turno = 'manana';
    if (noche[0] !== null && minutos >= noche[0] && minutos < noche[1]) turno = 'noche';
  }
  return { dia, turno, minutos };
}

// Cuando se le puede servir este menu al que esta mirando la pagina:
//   'ahora'  -> estamos en su turno
//   'hoy'    -> hoy es su dia y aun queda un turno suyo por delante
//   'manana' -> manana es su dia
//   null     -> no hay forma en los proximos dos dias: no se enseña
//
// No basta con "se sirve ahora": quien abre la pagina a las once de la noche
// puede querer encargarlo para mañana, y eso el bot ya sabe programarlo. Pero
// tampoco vale enseñar el menu del dia un viernes por la noche, porque mañana
// es sabado y no lo hay: seria prometer algo que no se puede cumplir.
const ANTELACION_MIN = 45;

function cuandoSePuede(menu, horarios, momento) {
  const dias = menu.dias_semana || [];
  // Sin horarios configurados no hay forma de saber en que turno estamos, y
  // escondiendo por si acaso no se enseñaba NINGUN menu. Mejor fallar del lado
  // de enseñarlos: es lo mismo que hace el bot dando por abierto un
  // restaurante que no ha rellenado su horario.
  if (!horarios || horarios.length === 0) {
    if (dias.includes(momento.dia)) return 'ahora';
    return dias.includes((momento.dia % 7) + 1) ? 'manana' : null;
  }
  const aMin = (t) => {
    if (!t) return null;
    const [a, b] = String(t).split(':');
    return parseInt(a, 10) * 60 + parseInt(b, 10);
  };
  const turnosDe = (dia) => {
    const h = (horarios || []).find((x) => x.dia_semana === dia);
    if (!h || h.cerrado) return [];
    return [
      { clave: 'manana', ap: aMin(h.manana_apertura), ci: aMin(h.manana_cierre) },
      { clave: 'noche', ap: aMin(h.noche_apertura), ci: aMin(h.noche_cierre) },
    ].filter((t) => t.ap !== null && t.ci !== null && t.ci > t.ap)
     .filter((t) => !menu.turno || menu.turno === t.clave);
  };

  if (dias.includes(momento.dia)) {
    if ((!menu.turno || menu.turno === momento.turno) && momento.turno) return 'ahora';
    // Hoy es su dia pero aun no toca: ¿queda algun turno suyo por delante?
    if (turnosDe(momento.dia).some((t) => t.ci > momento.minutos + ANTELACION_MIN)) return 'hoy';
  }

  const manana = (momento.dia % 7) + 1;
  if (dias.includes(manana) && turnosDe(manana).length > 0) return 'manana';

  return null;
}

export default function MenuInteractivo({ menus, whatsapp, textosDias, horarios }) {
  const momento = momentoAhora(horarios);
  // Solo los que se pueden servir de verdad. Elegir cinco platos para que al
  // final te digan que no hay menu es peor que no verlo.
  const disponibles = menus
    .map((m, i) => ({ m, i, cuando: cuandoSePuede(m, horarios, momento) }))
    .filter((x) => x.cuando !== null);
  const [abierto, setAbierto] = useState(menus.length === 1 ? 0 : null);
  const [elegido, setElegido] = useState({});   // "iMenu-iGrupo" -> nombre
  const [notas, setNotas] = useState({});       // "iMenu-iGrupo" -> texto
  const [notaAbierta, setNotaAbierta] = useState({});

  const clave = (im, ig) => im + '-' + ig;

  function formatoPrecio(p) {
    const n = Number(p);
    return isFinite(n) ? n.toFixed(2).replace('.', ',') + ' €' : '';
  }

  function opcionDe(menu, ig, nombre) {
    return (menu.grupos[ig].opciones || []).find((o) => o.nombre === nombre) || null;
  }

  // Los grupos que aún no tienen plato elegido.
  function faltan(im) {
    const menu = menus[im];
    return menu.grupos
      .map((g, ig) => (elegido[clave(im, ig)] ? null : g.nombre))
      .filter(Boolean);
  }

  function totalDe(im) {
    const menu = menus[im];
    const extra = menu.grupos.reduce((suma, g, ig) => {
      const op = opcionDe(menu, ig, elegido[clave(im, ig)]);
      return suma + Number(op?.suplemento || 0);
    }, 0);
    return Number(menu.precio) + extra;
  }

  // Formato acordado con el bot. Los dos puntos separan grupo y plato, y la
  // nota va entre paréntesis, igual que en la carta.
  function textoPedido(im) {
    const menu = menus[im];
    let t = 'Quiero pedir:\n\n';
    t += '1x MENU ' + menu.nombre + '\n';
    menu.grupos.forEach((g, ig) => {
      const nombre = elegido[clave(im, ig)];
      if (!nombre) return;
      const op = opcionDe(menu, ig, nombre);
      t += '  ' + g.nombre + ': ';
      if (op?.numero) t += '#' + op.numero + ' ';
      t += nombre;
      const nota = (notas[clave(im, ig)] || '').trim();
      // Paréntesis y saltos romperían el formato que parsea el bot.
      if (nota) t += ' (' + nota.replace(/[()\n]/g, ' ').trim() + ')';
      t += '\n';
    });
    t += '\nTotal aproximado: ' + formatoPrecio(totalDe(im));
    return t;
  }

  const digitos = String(whatsapp || '').replace(/\D/g, '');

  // Puede quedarse sin ninguno: un viernes por la noche el menu del dia ya no
  // se puede servir ni hoy ni mañana (sabado). Hay que decir cuando si.
  if (disponibles.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-text mb-2">Ahora mismo no hay menús que podamos servirte.</p>
        <ul className="text-xs text-text-muted space-y-0.5">
          {menus.map((m, i) => (
            <li key={m.id}>
              <span className="font-semibold">{m.nombre}</span>
              {textosDias[i] ? ': ' + textosDias[i] : ''}
              {m.turno === 'manana' ? ' a mediodía' : m.turno === 'noche' ? ' por la noche' : ''}
            </li>
          ))}
        </ul>
        <p className="text-xs text-text-muted mt-4">
          Puedes pedir de la carta a cualquier hora.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {disponibles.map(({ m: menu, i: im, cuando }) => {
        const pendientes = faltan(im);
        const listo = pendientes.length === 0;
        const url = digitos && listo
          ? 'https://wa.me/' + digitos + '?text=' + encodeURIComponent(textoPedido(im))
          : null;

        return (
          <section key={menu.id} className="rounded-2xl border border-border bg-surface overflow-hidden">
            <button
              onClick={() => setAbierto(abierto === im ? null : im)}
              className="w-full text-left px-5 py-4 flex items-start gap-3"
            >
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold">{menu.nombre}</h2>
                {(textosDias[im] || menu.turno) && (
                  <p className="text-xs text-text-muted mt-0.5">
                    {textosDias[im]}
                    {menu.turno === 'manana' ? ' a mediodía' : menu.turno === 'noche' ? ' por la noche' : ''}
                  </p>
                )}
                {/* En un menú cerrado la descripción no es un adorno: ES el
                    menú, lo único que dice de qué va. Así que ahí se pinta como
                    una lista legible y no como la línea gris de detalle. */}
                {/* Si el menu cerrado tiene sus platos enlazados, la lista sale
                    de ahi (con cantidades). Si no, de la descripcion. */}
                {(menu.grupos || []).length === 0 && (menu.platos || []).length > 0 ? (
                  <div className="mt-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Incluye</p>
                    <ul className="text-sm text-text mt-1 space-y-0.5">
                      {menu.platos.map((p, i) => (
                        <li key={i}>{Number(p.cantidad) > 1 ? p.cantidad + ' × ' : ''}{p.nombre}</li>
                      ))}
                    </ul>
                  </div>
                ) : menu.descripcion && (
                  (menu.grupos || []).length === 0 ? (
                    <div className="mt-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Incluye</p>
                      <p className="text-sm text-text mt-1 whitespace-pre-line">{menu.descripcion}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-text-muted mt-0.5 whitespace-pre-line">{menu.descripcion}</p>
                  )
                )}
                {/* No se esconde: se puede encargar para cuando toque, y el bot
                    ya sabe programarlo. Pero hay que decirlo antes de elegir. */}
                {cuando !== 'ahora' && (
                  <p className="text-xs text-accent mt-1.5">
                    Ahora no se sirve. Te lo dejamos encargado
                    {cuando === 'manana' ? ' para mañana.' : ' para más tarde.'}
                  </p>
                )}
              </div>
              <span className="text-lg font-bold text-accent tabular-nums shrink-0">
                {formatoPrecio(menu.precio)}
              </span>
            </button>

            {abierto === im && (
              <div className="px-5 pb-5 space-y-5 border-t border-border pt-4">
                {menu.grupos.map((g, ig) => {
                  const k = clave(im, ig);
                  const subgrupos = [];
                  (g.opciones || []).forEach((o) => {
                    if (o.subgrupo && !subgrupos.includes(o.subgrupo)) subgrupos.push(o.subgrupo);
                  });
                  const sueltas = (g.opciones || []).filter((o) => !o.subgrupo);

                  const pinta = (o) => (
                    <label
                      key={o.nombre}
                      className={`flex items-start gap-2.5 py-1.5 cursor-pointer ${
                        elegido[k] === o.nombre ? 'text-accent font-semibold' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={k}
                        checked={elegido[k] === o.nombre}
                        onChange={() => setElegido((p) => ({ ...p, [k]: o.nombre }))}
                        className="mt-1 accent-[var(--accent)]"
                      />
                      <span className="text-sm leading-snug">
                        {o.nombre}
                        {Number(o.suplemento) > 0 && (
                          <span className="text-text-muted font-normal">
                            {' '}(+{formatoPrecio(o.suplemento)})
                          </span>
                        )}
                      </span>
                    </label>
                  );

                  return (
                    <div key={g.nombre}>
                      <h3 className="text-sm font-bold uppercase tracking-wide text-text-muted mb-2">
                        {g.nombre}
                      </h3>

                      {sueltas.map(pinta)}
                      {subgrupos.map((sg) => (
                        <div key={sg} className="mt-2">
                          <p className="text-xs font-semibold text-text-muted mb-1">{sg}</p>
                          <div className="pl-3 border-l border-border">
                            {(g.opciones || []).filter((o) => o.subgrupo === sg).map(pinta)}
                          </div>
                        </div>
                      ))}

                      {/* La nota va por plato: es lo que no se puede hacer
                          decentemente en una conversacion de WhatsApp. */}
                      {elegido[k] && (
                        notaAbierta[k] || notas[k] ? (
                          <input
                            className="mt-2 w-full text-sm px-3 py-2 rounded-lg border border-border bg-surface-2"
                            placeholder="Sin cebolla, poco picante…"
                            value={notas[k] || ''}
                            onChange={(e) => setNotas((p) => ({ ...p, [k]: e.target.value }))}
                          />
                        ) : (
                          <button
                            onClick={() => setNotaAbierta((p) => ({ ...p, [k]: true }))}
                            className="mt-1.5 text-xs text-accent hover:underline"
                          >
                            + Añadir una indicación
                          </button>
                        )
                      )}
                    </div>
                  );
                })}

                <div className="pt-3 border-t border-border">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-text-muted">Total</span>
                    <span className="text-xl font-bold tabular-nums">{formatoPrecio(totalDe(im))}</span>
                  </div>

                  {listo ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-center px-5 py-3 rounded-full bg-accent text-white font-semibold shadow-card hover:bg-accent-hover transition-colors"
                    >
                      Pedir por WhatsApp
                    </a>
                  ) : (
                    <p className="text-center text-sm text-text-muted">
                      Te falta elegir: {pendientes.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

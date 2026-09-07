'use client';

import { useState } from 'react';

// Elegir el menú aquí en vez de por WhatsApp: se ve entero de un vistazo, se
// puede rectificar, cabe cualquier número de platos (WhatsApp solo pinta 10
// por lista) y cada plato admite su propia nota.
//
// El texto que se manda tiene que ser EXACTAMENTE el que entiende
// parsearMenuEstructurado() en el bot.
export default function MenuInteractivo({ menus, whatsapp, textosDias }) {
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

  return (
    <div className="space-y-6">
      {menus.map((menu, im) => {
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
                {menu.descripcion && (
                  <p className="text-xs text-text-muted mt-0.5">{menu.descripcion}</p>
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

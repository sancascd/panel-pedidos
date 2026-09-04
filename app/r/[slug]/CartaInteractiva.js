'use client';

// Carta con carrito. El cliente monta el pedido a clicks y se le abre WhatsApp
// con el texto ya escrito.
//
// DECISION IMPORTANTE: aqui NO se crea ningun pedido. Solo redactamos el
// mensaje; el pedido lo sigue creando el bot por WhatsApp, que es quien pide
// nombre, direccion, forma de pago y cambio. Un unico flujo que mantener. Y el
// total que vale es el que recalcula el bot desde la carta: este texto lo
// puede editar cualquiera antes de enviarlo.

import { useState } from 'react';
import { listaAlergenos } from '@/lib/alergenos';

function formatoPrecio(precio) {
  const n = Number(precio);
  if (!isFinite(n)) return '';
  return n.toFixed(2).replace('.', ',') + ' €';
}

export default function CartaInteractiva({ categorias, whatsapp }) {
  // { [clave]: { prod, cantidad, notas } }
  const [carrito, setCarrito] = useState({});
  const [notaAbierta, setNotaAbierta] = useState(null);
  const [verResumen, setVerResumen] = useState(false);

  const claveDe = (cat, i) => cat + '|' + i;

  function cambiarCantidad(clave, prod, delta) {
    setCarrito(prev => {
      const actual = prev[clave];
      const cantidad = (actual?.cantidad || 0) + delta;
      if (cantidad <= 0) {
        const copia = { ...prev };
        delete copia[clave];
        return copia;
      }
      return { ...prev, [clave]: { prod, cantidad, notas: actual?.notas || '' } };
    });
  }

  function cambiarNota(clave, notas) {
    setCarrito(prev => (prev[clave] ? { ...prev, [clave]: { ...prev[clave], notas } } : prev));
  }

  const lineas = Object.entries(carrito);
  const total = lineas.reduce((s, [, l]) => s + Number(l.prod.precio) * l.cantidad, 0);
  const unidades = lineas.reduce((s, [, l]) => s + l.cantidad, 0);

  // El formato tiene que ser EXACTAMENTE el que entiende
  // parsearPedidoEstructurado() en el bot: "2x #12 Nombre (nota)".
  // El numero de plato es lo que lo hace inequivoco.
  function textoPedido() {
    let t = 'Hola, quiero pedir:\n\n';
    lineas.forEach(([, l]) => {
      t += l.cantidad + 'x ';
      if (l.prod.numero) t += '#' + l.prod.numero + ' ';
      t += l.prod.nombre;
      const nota = (l.notas || '').trim();
      // Parentesis y saltos romperian el formato que parsea el bot.
      if (nota) t += ' (' + nota.replace(/[()\n]/g, ' ').trim() + ')';
      t += '\n';
    });
    t += '\nTotal aproximado: ' + formatoPrecio(total);
    return t;
  }

  const digitos = String(whatsapp || '').replace(/\D/g, '');
  const url = digitos && lineas.length > 0
    ? 'https://wa.me/' + digitos + '?text=' + encodeURIComponent(textoPedido())
    : null;

  return (
    <>
      <div className="space-y-10">
        {categorias.map((cat, i) => (
          <section key={i}>
            <h2 className="text-lg font-semibold text-accent border-b border-border pb-2 mb-4">
              {cat.nombre}
            </h2>
            <ul className="space-y-1">
              {cat.productos.map((prod, j) => {
                const clave = claveDe(i, j);
                const enCarrito = carrito[clave];
                return (
                  <li key={j} className="py-3 border-b border-border/50 last:border-0">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">
                          {prod.numero ? (
                            <span className="text-text-muted tabular-nums mr-1.5">{prod.numero}.</span>
                          ) : null}
                          {prod.nombre}
                        </p>
                        {prod.descripcion ? (
                          <p className="text-sm text-text-muted mt-0.5">{prod.descripcion}</p>
                        ) : null}
                        {(prod.contiene?.length || prod.trazas?.length) ? (
                          <p className="text-xs text-text-muted mt-1">
                            {prod.contiene?.length ? <>Contiene: {listaAlergenos(prod.contiene)}</> : null}
                            {prod.trazas?.length ? (
                              <>{prod.contiene?.length ? ' · ' : ''}Trazas: {listaAlergenos(prod.trazas)}</>
                            ) : null}
                          </p>
                        ) : null}
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className="font-semibold tabular-nums whitespace-nowrap">
                          {formatoPrecio(prod.precio)}
                        </span>
                        {enCarrito ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => cambiarCantidad(clave, prod, -1)}
                              className="w-9 h-9 rounded-lg border border-border text-lg leading-none flex items-center justify-center hover:border-accent transition-colors"
                              aria-label={'Quitar uno de ' + prod.nombre}
                            >
                              −
                            </button>
                            <span className="w-7 text-center font-semibold tabular-nums">
                              {enCarrito.cantidad}
                            </span>
                            <button
                              onClick={() => cambiarCantidad(clave, prod, 1)}
                              className="w-9 h-9 rounded-lg bg-accent text-white text-lg leading-none flex items-center justify-center hover:bg-accent-hover transition-colors"
                              aria-label={'Añadir otro ' + prod.nombre}
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => cambiarCantidad(clave, prod, 1)}
                            className="px-3 h-9 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-hover transition-colors"
                          >
                            Añadir
                          </button>
                        )}
                      </div>
                    </div>

                    {enCarrito ? (
                      <div className="mt-2">
                        {notaAbierta === clave || enCarrito.notas ? (
                          <input
                            type="text"
                            value={enCarrito.notas}
                            onChange={(e) => cambiarNota(clave, e.target.value)}
                            onBlur={() => setNotaAbierta(null)}
                            maxLength={120}
                            placeholder="Sin picante, sin cebolla..."
                            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-transparent focus:border-accent outline-none"
                          />
                        ) : (
                          <button
                            onClick={() => setNotaAbierta(clave)}
                            className="text-xs font-medium text-accent hover:underline"
                          >
                            + Añadir una nota
                          </button>
                        )}
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {unidades > 0 ? (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border shadow-lift">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3">
            {verResumen ? (
              <div className="mb-3 max-h-52 overflow-y-auto">
                {lineas.map(([clave, l]) => (
                  <div key={clave} className="flex items-baseline gap-2 text-sm py-1">
                    <span className="tabular-nums text-text-muted">{l.cantidad}x</span>
                    <span className="flex-1 min-w-0 truncate">
                      {l.prod.nombre}
                      {l.notas ? <span className="text-text-muted"> · {l.notas}</span> : null}
                    </span>
                    <span className="tabular-nums">{formatoPrecio(l.prod.precio * l.cantidad)}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-3">
              <button onClick={() => setVerResumen(v => !v)} className="text-left min-w-0">
                <span className="block text-sm font-semibold">
                  {unidades} {unidades === 1 ? 'artículo' : 'artículos'}
                </span>
                <span className="block text-xs text-accent">
                  {verResumen ? 'Ocultar' : 'Ver pedido'}
                </span>
              </button>

              <span className="ml-auto font-bold tabular-nums whitespace-nowrap">
                {formatoPrecio(total)}
              </span>

              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-full bg-accent text-white font-semibold text-sm shadow-card hover:bg-accent-hover transition-colors whitespace-nowrap"
                >
                  Pedir por WhatsApp
                </a>
              ) : null}
            </div>

            <p className="text-[11px] text-text-muted mt-2">
              Se abrirá WhatsApp con el pedido escrito. Solo tienes que enviarlo y
              te preguntaremos la entrega y la forma de pago.
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

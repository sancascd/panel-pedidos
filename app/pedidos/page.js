'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';

// URL del bot para mandar notificaciones al cliente.
// Puedes cambiar esta URL si tu bot esta en otro sitio.
const BOT_URL = 'https://bot-pedidos-production-f2b2.up.railway.app';

// Flujos de estado segun tipo de entrega
const FLUJO_DOMICILIO = {
  recibido:   { label: 'Pedido recibido', color: 'bg-red-100 text-red-700',       siguiente: 'listo',      siguienteLabel: 'Marcar como listo' },
  listo:      { label: 'Listo',           color: 'bg-yellow-100 text-yellow-700', siguiente: 'en_reparto', siguienteLabel: 'Marcar en reparto' },
  en_reparto: { label: 'En reparto',      color: 'bg-blue-100 text-blue-700',     siguiente: 'entregado',  siguienteLabel: 'Marcar como entregado' },
  entregado:  { label: 'Entregado',       color: 'bg-green-100 text-green-700',   siguiente: null,         siguienteLabel: null },
};

const FLUJO_RECOGIDA = {
  recibido:   { label: 'Pedido recibido',     color: 'bg-red-100 text-red-700',     siguiente: 'listo', siguienteLabel: 'Marcar como listo' },
  listo:      { label: 'Listo para recoger',  color: 'bg-green-100 text-green-700',  siguiente: null,    siguienteLabel: null },
};

function flujoDe(pedido) {
  return pedido.tipo_entrega === 'recogida' ? FLUJO_RECOGIDA : FLUJO_DOMICILIO;
}

function infoEstado(pedido) {
  const flujo = flujoDe(pedido);
  return flujo[pedido.estado] || { label: pedido.estado, color: 'bg-gray-100 text-gray-700', siguiente: null, siguienteLabel: null };
}

function columnaDe(pedido) {
  const estado = pedido.estado;
  const esRecogida = pedido.tipo_entrega === 'recogida';

  if (estado === 'recibido') return 'recibidos';
  if (estado === 'entregado') return 'finalizados';
  if (esRecogida && estado === 'listo') return 'finalizados';
  return 'proceso';
}

function telefonoLimpio(tel) {
  if (!tel) return '';
  return tel.replace('whatsapp:', '').replace(/\s/g, '').trim();
}

export default function PaginaPedidos() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [usuario, setUsuario] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);

  // Estados nuevos para el editor
  const [editando, setEditando] = useState(false);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [lineasEditadas, setLineasEditadas] = useState([]); // las lineas en edicion
  const [datosEditados, setDatosEditados] = useState(null); // nombre, direccion, metodo_pago, paga_con
  const [avisarCliente, setAvisarCliente] = useState(true);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [mensajeEdicion, setMensajeEdicion] = useState('');
  const [productoAAgregar, setProductoAAgregar] = useState('');

  const audioRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }
      setUsuario(session.user);

      const { data: admin } = await supabase.rpc('soy_superadmin');
      setEsAdmin(admin === true);

      await cargarPedidos();
      setCargando(false);
    }
    init();
  }, []);

  useEffect(() => {
    const canal = supabase
      .channel('pedidos-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        () => {
          if (audioRef.current) {
            audioRef.current.play().catch(() => {});
          }
          cargarPedidos();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        () => cargarPedidos()
      )
      .subscribe();

    return () => { supabase.removeChannel(canal); };
  }, []);

  async function cargarPedidos() {
    const { data } = await supabase
      .from('pedidos')
      .select('*')
      .order('creado_en', { ascending: true })
      .limit(100);
    setPedidos(data || []);
  }

  async function abrirPedido(pedido) {
    setSeleccionado(pedido);
    setEditando(false);
    setMensajeEdicion('');
    const { data } = await supabase
      .from('lineas_pedido')
      .select('*')
      .eq('pedido_id', pedido.id);
    setLineas(data || []);
  }

  function cerrarDetalle() {
    setSeleccionado(null);
    setLineas([]);
    setEditando(false);
  }

  async function cambiarEstado(pedido, nuevoEstado) {
    await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', pedido.id);
    setSeleccionado({ ...pedido, estado: nuevoEstado });
  }

  // ---------- EDICION DE PEDIDOS ----------

  async function abrirEditor() {
    // Cargamos los productos disponibles para poder añadir
    const { data: productos } = await supabase
      .from('productos')
      .select('id, nombre, precio')
      .eq('restaurante_id', seleccionado.restaurante_id)
      .eq('disponible', true)
      .order('nombre');
    setProductosDisponibles(productos || []);

    // Copiamos las lineas actuales para editar
    setLineasEditadas(lineas.map(l => ({
      id: l.id, // si tiene id, es una linea existente
      producto_id: l.producto_id,
      nombre_producto: l.nombre_producto,
      cantidad: l.cantidad,
      precio_unitario: Number(l.precio_unitario)
    })));

    // Copiamos los datos editables del pedido
    setDatosEditados({
      cliente_nombre: seleccionado.cliente_nombre || '',
      cliente_direccion: seleccionado.cliente_direccion || '',
      metodo_pago: seleccionado.metodo_pago || 'efectivo',
      paga_con: seleccionado.paga_con ? Number(seleccionado.paga_con) : 0
    });

    setAvisarCliente(true);
    setEditando(true);
    setMensajeEdicion('');
  }

  function cancelarEdicion() {
    setEditando(false);
    setLineasEditadas([]);
    setDatosEditados(null);
    setProductoAAgregar('');
    setMensajeEdicion('');
  }

  // Cambia la cantidad de una linea editada
  function cambiarCantidad(index, nuevaCantidad) {
    const cantidad = Math.max(0, parseInt(nuevaCantidad, 10) || 0);
    setLineasEditadas(prev => {
      const copia = [...prev];
      copia[index] = { ...copia[index], cantidad: cantidad };
      return copia;
    });
  }

  // Elimina una linea
  function eliminarLinea(index) {
    setLineasEditadas(prev => prev.filter((_, i) => i !== index));
  }

  // Añade un producto nuevo al pedido
  function agregarProducto() {
    if (!productoAAgregar) return;
    const prod = productosDisponibles.find(p => p.id === productoAAgregar);
    if (!prod) return;

    // Si ya esta en el pedido, sumamos una unidad
    const yaExiste = lineasEditadas.findIndex(l => l.producto_id === prod.id);
    if (yaExiste >= 0) {
      cambiarCantidad(yaExiste, lineasEditadas[yaExiste].cantidad + 1);
    } else {
      setLineasEditadas(prev => [...prev, {
        id: null, // null = linea nueva
        producto_id: prod.id,
        nombre_producto: prod.nombre,
        cantidad: 1,
        precio_unitario: Number(prod.precio)
      }]);
    }
    setProductoAAgregar('');
  }

  function totalEditado() {
    return lineasEditadas
      .filter(l => l.cantidad > 0)
      .reduce((sum, l) => sum + (l.cantidad * l.precio_unitario), 0);
  }

  function actualizarDatos(campo, valor) {
    setDatosEditados(prev => ({ ...prev, [campo]: valor }));
  }

  async function guardarCambios() {
    setGuardandoEdicion(true);
    setMensajeEdicion('');

    try {
      const lineasValidas = lineasEditadas.filter(l => l.cantidad > 0);

      if (lineasValidas.length === 0) {
        setMensajeEdicion('El pedido debe tener al menos un producto.');
        setGuardandoEdicion(false);
        return;
      }

      const nuevoTotal = totalEditado();
      const cambio = (datosEditados.metodo_pago === 'efectivo' && datosEditados.paga_con > 0)
        ? Math.max(0, datosEditados.paga_con - nuevoTotal)
        : null;

      // 1. Actualizar el pedido
      const { error: errPedido } = await supabase
        .from('pedidos')
        .update({
          cliente_nombre: datosEditados.cliente_nombre,
          cliente_direccion: datosEditados.cliente_direccion,
          metodo_pago: datosEditados.metodo_pago,
          paga_con: datosEditados.paga_con > 0 ? datosEditados.paga_con : null,
          cambio: cambio,
          total: nuevoTotal
        })
        .eq('id', seleccionado.id);

      if (errPedido) throw errPedido;

      // 2. Borrar todas las lineas viejas
      await supabase
        .from('lineas_pedido')
        .delete()
        .eq('pedido_id', seleccionado.id);

      // 3. Insertar las nuevas
      const lineasNuevas = lineasValidas.map(l => ({
        pedido_id: seleccionado.id,
        producto_id: l.producto_id,
        nombre_producto: l.nombre_producto,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        restaurante_id: seleccionado.restaurante_id
      }));

      const { error: errLineas } = await supabase
        .from('lineas_pedido')
        .insert(lineasNuevas);

      if (errLineas) throw errLineas;

      // 4. Si el usuario marco "avisar al cliente", llamamos al bot
      if (avisarCliente) {
        try {
          const resp = await fetch(BOT_URL + '/notificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pedido_id: seleccionado.id })
          });
          if (!resp.ok) {
            console.log('Aviso al cliente fallido, status:', resp.status);
            setMensajeEdicion('Pedido guardado, pero no se pudo avisar al cliente.');
          } else {
            setMensajeEdicion('Pedido guardado y cliente avisado por WhatsApp.');
          }
        } catch (e) {
          console.log('Error avisando al cliente:', e);
          setMensajeEdicion('Pedido guardado, pero no se pudo avisar al cliente.');
        }
      } else {
        setMensajeEdicion('Pedido guardado (sin avisar al cliente).');
      }

      // 5. Recargar lineas y pedido en pantalla
      const { data: lineasFrescas } = await supabase
        .from('lineas_pedido')
        .select('*')
        .eq('pedido_id', seleccionado.id);
      setLineas(lineasFrescas || []);

      const { data: pedidoFresco } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', seleccionado.id)
        .maybeSingle();
      if (pedidoFresco) setSeleccionado(pedidoFresco);

      setGuardandoEdicion(false);
      setEditando(false);

      // Quitar mensaje despues de unos segundos
      setTimeout(() => setMensajeEdicion(''), 5000);

    } catch (e) {
      console.log('Error guardarCambios:', e);
      setMensajeEdicion('Error al guardar: ' + (e.message || 'desconocido'));
      setGuardandoEdicion(false);
    }
  }

  // Imprimir comanda
  function imprimirComanda() {
    window.print();
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/');
  }

  function formatearFecha(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatearHora(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  function etiquetaEntrega(pedido) {
    if (pedido.tipo_entrega === 'recogida') {
      return { texto: '🏪 Recogida', clase: 'bg-purple-100 text-purple-700' };
    }
    return { texto: '🏠 Domicilio', clase: 'bg-orange-100 text-orange-700' };
  }

  function textoPago(pedido) {
    if (pedido.metodo_pago === 'tarjeta') {
      return '💳 Tarjeta';
    }
    if (pedido.metodo_pago === 'efectivo') {
      if (pedido.cambio && Number(pedido.cambio) > 0) {
        return '💵 Efectivo — paga con ' + Number(pedido.paga_con).toFixed(2) +
               '€ — cambio: ' + Number(pedido.cambio).toFixed(2) + '€';
      }
      return '💵 Efectivo — importe justo';
    }
    return 'No especificado';
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  const columnas = {
    recibidos: pedidos.filter(p => columnaDe(p) === 'recibidos'),
    proceso: pedidos.filter(p => columnaDe(p) === 'proceso'),
    finalizados: pedidos.filter(p => columnaDe(p) === 'finalizados'),
  };

  const defColumnas = [
    { key: 'recibidos',  titulo: 'Recibidos',   emoji: '🔴', sub: 'Hay que prepararlos' },
    { key: 'proceso',    titulo: 'En proceso',  emoji: '🟡', sub: 'Listos o en reparto' },
    { key: 'finalizados', titulo: 'Finalizados', emoji: '✅', sub: 'Entregados o recogidos' },
  ];

  function TarjetaPedido({ p }) {
    const est = infoEstado(p);
    const entrega = etiquetaEntrega(p);
    return (
      <button
        onClick={() => abrirPedido(p)}
        className="w-full text-left bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition border border-gray-200"
      >
        <div className="flex justify-between items-start mb-1">
          <span className="font-bold text-gray-900">#{p.id.slice(-4).toUpperCase()}</span>
          <span className="text-xs text-gray-400">{formatearHora(p.creado_en)}</span>
        </div>
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full ${entrega.clase}`}>
            {entrega.texto}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${est.color}`}>
            {est.label}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">{p.cliente_telefono}</span>
          <span className="font-semibold text-gray-900">{Number(p.total).toFixed(2)}€</span>
        </div>
      </button>
    );
  }

  // Si esta editado, mostramos la interfaz de edicion en lugar del detalle normal
  const seEstaEditando = editando && seleccionado;
  const sePuedeEditar = seleccionado && seleccionado.estado !== 'entregado';

  return (
    <div className="min-h-screen">
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg" preload="auto" />

      {/* Estilos especiales para la impresion. */}
      <style>{`
        @media print {
          @page { size: 80mm auto; margin: 3mm; }
          body { background: white !important; }
          .no-imprimir { display: none !important; }
          .zona-imprimible {
            display: block !important; position: static !important;
            background: white !important; box-shadow: none !important;
            padding: 0 !important; margin: 0 !important;
            max-width: none !important; max-height: none !important;
            overflow: visible !important; color: black !important;
          }
          .zona-imprimible * { color: black !important; }
          .ticket {
            font-family: 'Courier New', monospace;
            font-size: 16pt; line-height: 1.35; font-weight: bold;
          }
          .ticket h1 { font-size: 28pt; text-align: center; margin: 0 0 4mm 0; }
          .ticket .separador { border-top: 2px dashed #000; margin: 3mm 0; }
          .ticket .grande { font-size: 20pt; font-weight: bold; }
          .ticket table { width: 100%; border-collapse: collapse; }
          .ticket table th, .ticket table td {
            text-align: left; padding: 1.5mm 0; font-size: 17pt;
          }
          .ticket table .col-cant { width: 14%; text-align: center; }
          .ticket table .col-prod { width: 58%; }
          .ticket table .col-tot { width: 28%; text-align: right; }
          .ticket .total {
            font-size: 22pt; font-weight: bold;
            text-align: right; margin-top: 2mm;
          }
        }
        @media screen { .solo-imprimir { display: none; } }
      `}</style>

      <header className="bg-white border-b shadow-sm no-imprimir">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">📋 Panel de Pedidos</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{usuario?.email}</span>
            <a href="/carta" className="text-sm text-blue-600 hover:text-blue-700 font-medium">🍕 Mi carta</a>
            <a href="/horarios" className="text-sm text-blue-600 hover:text-blue-700 font-medium">🕐 Horarios</a>
            {esAdmin && (
              <a href="/admin" className="text-sm text-blue-600 hover:text-blue-700 font-medium">🛡️ Admin</a>
            )}
            <button onClick={cerrarSesion} className="text-sm text-gray-600 hover:text-red-600">
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 no-imprimir">
        {mensajeEdicion && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-4">{mensajeEdicion}</div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {defColumnas.map(col => (
            <div key={col.key} className="bg-gray-100 rounded-xl p-3">
              <div className="mb-3 px-1">
                <h2 className="font-bold text-gray-900">
                  {col.emoji} {col.titulo} ({columnas[col.key].length})
                </h2>
                <p className="text-xs text-gray-500">{col.sub}</p>
              </div>
              <div className="space-y-2">
                {columnas[col.key].length === 0 ? (
                  <p className="text-sm text-gray-400 px-1 py-4 text-center">Sin pedidos aquí</p>
                ) : (
                  columnas[col.key].map(p => <TarjetaPedido key={p.id} p={p} />)
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* MODAL: detalle o edicion */}
      {seleccionado && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 no-imprimir"
          style={{ backgroundColor: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={cerrarDetalle}
        >
          <div
            className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {seEstaEditando ? 'Editar pedido' : 'Pedido'} #{seleccionado.id.slice(-4).toUpperCase()}
                </h2>
                <p className="text-gray-500 text-sm">{formatearFecha(seleccionado.creado_en)}</p>
              </div>
              <button onClick={cerrarDetalle} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            {/* ===================== MODO EDICION ===================== */}
            {seEstaEditando ? (
              <div>
                {/* Datos del cliente */}
                <div className="space-y-3 mb-6 text-sm">
                  <div>
                    <label className="text-gray-500 block mb-1">Nombre del cliente</label>
                    <input
                      type="text"
                      value={datosEditados.cliente_nombre}
                      onChange={(e) => actualizarDatos('cliente_nombre', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    />
                  </div>
                  {seleccionado.tipo_entrega !== 'recogida' && (
                    <div>
                      <label className="text-gray-500 block mb-1">Dirección</label>
                      <input
                        type="text"
                        value={datosEditados.cliente_direccion}
                        onChange={(e) => actualizarDatos('cliente_direccion', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-gray-500 block mb-1">Método de pago</label>
                    <select
                      value={datosEditados.metodo_pago}
                      onChange={(e) => actualizarDatos('metodo_pago', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded"
                    >
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                    </select>
                  </div>
                  {datosEditados.metodo_pago === 'efectivo' && (
                    <div>
                      <label className="text-gray-500 block mb-1">Paga con (€) — déjalo en 0 si es justo</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={datosEditados.paga_con}
                        onChange={(e) => actualizarDatos('paga_con', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded"
                      />
                    </div>
                  )}
                </div>

                {/* Productos editables */}
                <div className="border-t pt-4 mb-4">
                  <h3 className="font-semibold mb-3">Productos</h3>
                  <div className="space-y-2 mb-4">
                    {lineasEditadas.map((l, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                        <div className="flex-1 text-sm">
                          <p className="font-medium">{l.nombre_producto}</p>
                          <p className="text-gray-500 text-xs">{l.precio_unitario.toFixed(2)}€ / unidad</p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          value={l.cantidad}
                          onChange={(e) => cambiarCantidad(idx, e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                        />
                        <span className="text-sm w-16 text-right font-medium">
                          {(l.cantidad * l.precio_unitario).toFixed(2)}€
                        </span>
                        <button
                          onClick={() => eliminarLinea(idx)}
                          className="text-red-500 hover:text-red-700 text-lg leading-none px-1"
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Añadir producto nuevo */}
                  <div className="flex gap-2 mb-2">
                    <select
                      value={productoAAgregar}
                      onChange={(e) => setProductoAAgregar(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm"
                    >
                      <option value="">Añadir producto...</option>
                      {productosDisponibles.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} — {Number(p.precio).toFixed(2)}€
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={agregarProducto}
                      disabled={!productoAAgregar}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded text-sm"
                    >
                      + Añadir
                    </button>
                  </div>
                </div>

                {/* Total */}
                <div className="border-t pt-3 mb-4 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{totalEditado().toFixed(2)}€</span>
                </div>

                {/* Avisar cliente */}
                <label className="flex items-start gap-2 mb-4 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={avisarCliente}
                    onChange={(e) => setAvisarCliente(e.target.checked)}
                    className="mt-1 w-4 h-4"
                  />
                  <span>
                    <strong>Avisar al cliente por WhatsApp</strong> de los cambios.
                    {' '}<span className="text-gray-500">(Recomendado si has cambiado productos o el total)</span>
                  </span>
                </label>

                {/* Botones de accion */}
                <div className="flex gap-2">
                  <button
                    onClick={cancelarEdicion}
                    disabled={guardandoEdicion}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={guardarCambios}
                    disabled={guardandoEdicion}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-lg"
                  >
                    {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            ) : (
              /* ===================== MODO DETALLE (NO EDICION) ===================== */
              <div>
                <div className="flex gap-2 mb-6 flex-wrap items-center">
                  <span className={`text-sm px-3 py-1 rounded-full ${infoEstado(seleccionado).color}`}>
                    {infoEstado(seleccionado).label}
                  </span>
                  <span className={`text-sm px-3 py-1 rounded-full ${etiquetaEntrega(seleccionado).clase}`}>
                    {etiquetaEntrega(seleccionado).texto}
                  </span>
                  <button
                    onClick={imprimirComanda}
                    className="ml-auto text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-1.5 rounded-lg"
                  >
                    🖨️ Imprimir
                  </button>
                  {sePuedeEditar && (
                    <button
                      onClick={abrirEditor}
                      className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium px-3 py-1.5 rounded-lg"
                    >
                      ✏️ Editar pedido
                    </button>
                  )}
                </div>

                <div className="space-y-3 mb-6 text-sm">
                  <div>
                    <p className="text-gray-500">Teléfono</p>
                    <p className="font-medium">{seleccionado.cliente_telefono}</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3 no-imprimir">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent('tel:' + telefonoLimpio(seleccionado.cliente_telefono))}`}
                      alt="QR para llamar al cliente"
                      width="90" height="90"
                      className="rounded bg-white p-1"
                    />
                    <div className="text-sm">
                      <p className="font-medium text-gray-900">Llamar al cliente</p>
                      <p className="text-gray-500">Escanea con la cámara del móvil.</p>
                      <a href={`tel:${telefonoLimpio(seleccionado.cliente_telefono)}`} className="text-blue-600 hover:underline text-xs">
                        O pulsa aquí para llamar
                      </a>
                    </div>
                  </div>

                  <div>
                    <p className="text-gray-500">Cliente</p>
                    <p className="font-medium">{seleccionado.cliente_nombre || '-'}</p>
                  </div>
                  {seleccionado.tipo_entrega !== 'recogida' ? (
                    <div>
                      <p className="text-gray-500">Dirección</p>
                      <p className="font-medium">{seleccionado.cliente_direccion || '-'}</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-500">Tipo</p>
                      <p className="font-medium">El cliente recoge en el local</p>
                    </div>
                  )}
                  <div>
                    <p className="text-gray-500">Pago</p>
                    <p className="font-medium">{textoPago(seleccionado)}</p>
                  </div>
                </div>

                <div className="border-t pt-4 mb-6">
                  <h3 className="font-semibold mb-3">Productos</h3>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-500 text-left">
                        <th className="pb-2">Producto</th>
                        <th className="pb-2 text-center">Cant.</th>
                        <th className="pb-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineas.map(l => (
                        <tr key={l.id} className="border-t">
                          <td className="py-2">{l.nombre_producto}</td>
                          <td className="py-2 text-center">{l.cantidad}</td>
                          <td className="py-2 text-right">{(l.cantidad * l.precio_unitario).toFixed(2)}€</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t font-semibold">
                        <td colSpan="2" className="pt-3 text-right">Total</td>
                        <td className="pt-3 text-right">{Number(seleccionado.total).toFixed(2)}€</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {infoEstado(seleccionado).siguiente ? (
                  <button
                    onClick={() => cambiarEstado(seleccionado, infoEstado(seleccionado).siguiente)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg"
                  >
                    {infoEstado(seleccionado).siguienteLabel} →
                  </button>
                ) : (
                  <div className="w-full bg-gray-100 text-gray-500 text-center font-medium py-3 rounded-lg">
                    Pedido finalizado
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Zona imprimible */}
      {seleccionado && !editando && (
        <div className="zona-imprimible solo-imprimir ticket">
          <h1>PEDIDO #{seleccionado.id.slice(-4).toUpperCase()}</h1>
          <p style={{ textAlign: 'center', margin: '0 0 3mm 0' }}>{formatearFecha(seleccionado.creado_en)}</p>
          <div className="separador"></div>
          <p className="grande">{seleccionado.tipo_entrega === 'recogida' ? 'RECOGIDA EN LOCAL' : 'A DOMICILIO'}</p>
          <div className="separador"></div>
          <p><strong>Cliente:</strong> {seleccionado.cliente_nombre || '-'}</p>
          <p><strong>Telefono:</strong> {telefonoLimpio(seleccionado.cliente_telefono)}</p>
          {seleccionado.tipo_entrega !== 'recogida' && (
            <p><strong>Direccion:</strong> {seleccionado.cliente_direccion || '-'}</p>
          )}
          <div className="separador"></div>
          <table>
            <thead>
              <tr>
                <th className="col-cant">Cant</th>
                <th className="col-prod">Producto</th>
                <th className="col-tot">Total</th>
              </tr>
            </thead>
            <tbody>
              {lineas.map(l => (
                <tr key={l.id}>
                  <td className="col-cant">{l.cantidad}x</td>
                  <td className="col-prod">{l.nombre_producto}</td>
                  <td className="col-tot">{(l.cantidad * l.precio_unitario).toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="separador"></div>
          <p className="total">TOTAL: {Number(seleccionado.total).toFixed(2)}€</p>
          <div className="separador"></div>
          <p><strong>Pago:</strong> {
            seleccionado.metodo_pago === 'tarjeta' ? 'TARJETA' :
            seleccionado.metodo_pago === 'efectivo' ?
              (seleccionado.cambio && Number(seleccionado.cambio) > 0
                ? 'EFECTIVO (paga con ' + Number(seleccionado.paga_con).toFixed(2) + 'EUR, cambio ' + Number(seleccionado.cambio).toFixed(2) + 'EUR)'
                : 'EFECTIVO (importe justo)')
            : '-'
          }</p>
          <div className="separador"></div>
          <p style={{ textAlign: 'center', fontSize: '10pt' }}>Gracias!</p>
        </div>
      )}
    </div>
  );
}

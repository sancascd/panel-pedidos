'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';

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
    const { data } = await supabase
      .from('lineas_pedido')
      .select('*')
      .eq('pedido_id', pedido.id);
    setLineas(data || []);
  }

  function cerrarDetalle() {
    setSeleccionado(null);
    setLineas([]);
  }

  async function cambiarEstado(pedido, nuevoEstado) {
    await supabase
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', pedido.id);
    setSeleccionado({ ...pedido, estado: nuevoEstado });
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

  return (
    <div className="min-h-screen">
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg" preload="auto" />

      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">📋 Panel de Pedidos</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{usuario?.email}</span>
            <a href="/carta" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              🍕 Mi carta
            </a>
            <a href="/horarios" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              🕐 Horarios
            </a>
            {esAdmin && (
              <a href="/admin" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                🛡️ Admin
              </a>
            )}
            <button
              onClick={cerrarSesion}
              className="text-sm text-gray-600 hover:text-red-600"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6">
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
                  <p className="text-sm text-gray-400 px-1 py-4 text-center">
                    Sin pedidos aquí
                  </p>
                ) : (
                  columnas[col.key].map(p => <TarjetaPedido key={p.id} p={p} />)
                )}
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Modal de detalle centrado, con fondo desenfocado */}
      {seleccionado && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
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
                  Pedido #{seleccionado.id.slice(-4).toUpperCase()}
                </h2>
                <p className="text-gray-500 text-sm">{formatearFecha(seleccionado.creado_en)}</p>
              </div>
              <button
                onClick={cerrarDetalle}
                className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="flex gap-2 mb-6 flex-wrap">
              <span className={`text-sm px-3 py-1 rounded-full ${infoEstado(seleccionado).color}`}>
                {infoEstado(seleccionado).label}
              </span>
              <span className={`text-sm px-3 py-1 rounded-full ${etiquetaEntrega(seleccionado).clase}`}>
                {etiquetaEntrega(seleccionado).texto}
              </span>
            </div>

            <div className="space-y-3 mb-6 text-sm">
              <div>
                <p className="text-gray-500">Teléfono</p>
                <p className="font-medium">{seleccionado.cliente_telefono}</p>
              </div>

              {/* QR para llamar rapido al cliente */}
              <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent('tel:' + telefonoLimpio(seleccionado.cliente_telefono))}`}
                  alt="QR para llamar al cliente"
                  width="90"
                  height="90"
                  className="rounded bg-white p-1"
                />
                <div className="text-sm">
                  <p className="font-medium text-gray-900">Llamar al cliente</p>
                  <p className="text-gray-500">
                    Escanea este código con la cámara del móvil para llamar directamente.
                  </p>
                  <a
                    href={`tel:${telefonoLimpio(seleccionado.cliente_telefono)}`}
                    className="text-blue-600 hover:underline text-xs"
                  >
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
              >
                {infoEstado(seleccionado).siguienteLabel} →
              </button>
            ) : (
              <div className="w-full bg-gray-100 text-gray-500 text-center font-medium py-3 rounded-lg">
                Pedido finalizado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

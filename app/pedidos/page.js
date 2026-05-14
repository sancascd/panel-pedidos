'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';

const ESTADOS = {
  nuevo: { label: 'Nuevo', color: 'bg-red-100 text-red-700', siguiente: 'en_preparacion', siguienteLabel: 'Empezar a preparar' },
  en_preparacion: { label: 'En preparación', color: 'bg-yellow-100 text-yellow-700', siguiente: 'listo', siguienteLabel: 'Marcar como listo' },
  listo: { label: 'Listo', color: 'bg-blue-100 text-blue-700', siguiente: 'entregado', siguienteLabel: 'Marcar como entregado' },
  entregado: { label: 'Entregado', color: 'bg-green-100 text-green-700', siguiente: null, siguienteLabel: null },
};

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
      .order('creado_en', { ascending: false })
      .limit(50);
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

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
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

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-3 gap-6">

        <div className="md:col-span-1">
          <h2 className="text-lg font-semibold mb-3">Pedidos recientes ({pedidos.length})</h2>
          {pedidos.length === 0 ? (
            <p className="text-gray-500 text-sm bg-white p-4 rounded-lg">
              Aún no hay pedidos. Cuando llegue uno por WhatsApp aparecerá aquí.
            </p>
          ) : (
            <div className="space-y-2">
              {pedidos.map(p => {
                const est = ESTADOS[p.estado] || ESTADOS.nuevo;
                return (
                  <button
                    key={p.id}
                    onClick={() => abrirPedido(p)}
                    className={`w-full text-left bg-white p-4 rounded-lg shadow-sm hover:shadow-md transition border-2 ${
                      seleccionado?.id === p.id ? 'border-blue-500' : 'border-transparent'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold">#{p.id.slice(-4).toUpperCase()}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${est.color}`}>
                        {est.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{p.cliente_telefono}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-gray-400">{formatearFecha(p.creado_en)}</span>
                      <span className="font-semibold text-gray-900">{Number(p.total).toFixed(2)}€</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="md:col-span-2">
          {!seleccionado ? (
            <div className="bg-white p-8 rounded-lg text-center text-gray-500">
              👈 Selecciona un pedido para ver el detalle
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold">Pedido #{seleccionado.id.slice(-4).toUpperCase()}</h2>
                  <p className="text-gray-500 text-sm">{formatearFecha(seleccionado.creado_en)}</p>
                </div>
                <span className={`text-sm px-3 py-1 rounded-full ${ESTADOS[seleccionado.estado].color}`}>
                  {ESTADOS[seleccionado.estado].label}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                <div>
                  <p className="text-gray-500">Teléfono</p>
                  <p className="font-medium">{seleccionado.cliente_telefono}</p>
                </div>
                <div>
                  <p className="text-gray-500">Cliente</p>
                  <p className="font-medium">{seleccionado.cliente_nombre || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Dirección</p>
                  <p className="font-medium">{seleccionado.cliente_direccion || '-'}</p>
                </div>
              </div>

              <div className="border-t pt-4 mb-6">
                <h3 className="font-semibold mb-3">Productos</h3>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-left">
                      <th className="pb-2">Producto</th>
                      <th className="pb-2 text-center">Cant.</th>
                      <th className="pb-2 text-right">Precio</th>
                      <th className="pb-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map(l => (
                      <tr key={l.id} className="border-t">
                        <td className="py-2">{l.nombre_producto}</td>
                        <td className="py-2 text-center">{l.cantidad}</td>
                        <td className="py-2 text-right">{Number(l.precio_unitario).toFixed(2)}€</td>
                        <td className="py-2 text-right">{(l.cantidad * l.precio_unitario).toFixed(2)}€</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-semibold">
                      <td colSpan="3" className="pt-3 text-right">Total</td>
                      <td className="pt-3 text-right">{Number(seleccionado.total).toFixed(2)}€</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {ESTADOS[seleccionado.estado].siguiente && (
                <button
                  onClick={() => cambiarEstado(seleccionado, ESTADOS[seleccionado.estado].siguiente)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition"
                >
                  {ESTADOS[seleccionado.estado].siguienteLabel} →
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

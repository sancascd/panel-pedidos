'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';

const BOT_URL = 'https://bot-pedidos-production-f2b2.up.railway.app';
const HORAS_LIMITE_AVISO = 24;

const HORA_INICIO_DIA = 6;

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

function horasDesde(iso) {
  if (!iso) return 0;
  return (Date.now() - new Date(iso).getTime()) / 1000 / 3600;
}

function inicioDiaTrabajo() {
  const ahora = new Date();
  const inicio = new Date(ahora);
  inicio.setHours(HORA_INICIO_DIA, 0, 0, 0);
  if (ahora.getHours() < HORA_INICIO_DIA) {
    inicio.setDate(inicio.getDate() - 1);
  }
  return inicio.getTime();
}

function esDelDiaActual(pedido) {
  if (!pedido.creado_en) return false;
  return new Date(pedido.creado_en).getTime() >= inicioDiaTrabajo();
}

export default function PaginaPedidos() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [usuario, setUsuario] = useState(null);
  const [restaurante, setRestaurante] = useState(null); // nombre + logo del restaurante actual
  const [pedidos, setPedidos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);

  const [pestana, setPestana] = useState('hoy');
  const [finalizadosAbierto, setFinalizadosAbierto] = useState(false);

  const [historialPedidos, setHistorialPedidos] = useState([]);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [filtroTelefono, setFiltroTelefono] = useState('');
  const [filtroFecha, setFiltroFecha] = useState('');

  const [editando, setEditando] = useState(false);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [lineasEditadas, setLineasEditadas] = useState([]);
  const [datosEditados, setDatosEditados] = useState(null);
  const [avisarCliente, setAvisarCliente] = useState(true);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [mensajeEdicion, setMensajeEdicion] = useState('');
  const [productoAAgregar, setProductoAAgregar] = useState('');

  const audioRef = useRef(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }
      setUsuario(session.user);
      const { data: admin } = await supabase.rpc('soy_superadmin');
      setEsAdmin(admin === true);

      // Cargamos los datos del restaurante (nombre + logo) para mostrarlos en la cabecera
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (restId) {
        const { data: rest } = await supabase
          .from('restaurantes')
          .select('id, nombre, logo_url')
          .eq('id', restId)
          .maybeSingle();
        if (rest) setRestaurante(rest);
      }

      await cargarPedidos();
      setCargando(false);
    }
    init();
  }, []);

  useEffect(() => {
    const canal = supabase.channel('pedidos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => {
        if (audioRef.current) audioRef.current.play().catch(() => {});
        cargarPedidos();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, () => cargarPedidos())
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  async function cargarPedidos() {
    const { data } = await supabase
      .from('pedidos').select('*')
      .order('creado_en', { ascending: true }).limit(500);
    setPedidos(data || []);
  }

  async function cargarHistorial() {
    setHistorialCargando(true);
    let query = supabase.from('pedidos').select('*').order('creado_en', { ascending: false });

    if (filtroTelefono.trim()) {
      query = query.ilike('cliente_telefono', '%' + filtroTelefono.trim() + '%');
    }
    if (filtroFecha) {
      const inicio = new Date(filtroFecha + 'T00:00:00');
      const fin = new Date(filtroFecha + 'T23:59:59');
      query = query.gte('creado_en', inicio.toISOString()).lte('creado_en', fin.toISOString());
    }
    query = query.limit(200);

    const { data } = await query;
    setHistorialPedidos(data || []);
    setHistorialCargando(false);
  }

  useEffect(() => {
    if (pestana === 'historial') cargarHistorial();
  }, [pestana]);

  async function abrirPedido(pedido) {
    setSeleccionado(pedido);
    setEditando(false);
    setMensajeEdicion('');
    const { data } = await supabase
      .from('lineas_pedido').select('*').eq('pedido_id', pedido.id);
    setLineas(data || []);
  }

  function cerrarDetalle() {
    setSeleccionado(null);
    setLineas([]);
    setEditando(false);
  }

  async function cambiarEstado(pedido, nuevoEstado) {
    await supabase.from('pedidos').update({ estado: nuevoEstado }).eq('id', pedido.id);
    setSeleccionado({ ...pedido, estado: nuevoEstado });
  }

  async function abrirEditor() {
    const { data: productos } = await supabase
      .from('productos').select('id, nombre, precio')
      .eq('restaurante_id', seleccionado.restaurante_id)
      .eq('disponible', true).order('nombre');
    setProductosDisponibles(productos || []);

    setLineasEditadas(lineas.map(l => ({
      id: l.id, producto_id: l.producto_id,
      nombre_producto: l.nombre_producto,
      cantidad: l.cantidad, precio_unitario: Number(l.precio_unitario)
    })));

    setDatosEditados({
      cliente_nombre: seleccionado.cliente_nombre || '',
      cliente_direccion: seleccionado.cliente_direccion || '',
      metodo_pago: seleccionado.metodo_pago || 'efectivo',
      paga_con: seleccionado.paga_con ? Number(seleccionado.paga_con) : 0
    });

    const horas = horasDesde(seleccionado.creado_en);
    setAvisarCliente(horas <= HORAS_LIMITE_AVISO);

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

  function cambiarCantidad(index, nuevaCantidad) {
    const cantidad = Math.max(0, parseInt(nuevaCantidad, 10) || 0);
    setLineasEditadas(prev => {
      const copia = [...prev];
      copia[index] = { ...copia[index], cantidad: cantidad };
      return copia;
    });
  }

  function eliminarLinea(index) {
    setLineasEditadas(prev => prev.filter((_, i) => i !== index));
  }

  function agregarProducto() {
    if (!productoAAgregar) return;
    const prod = productosDisponibles.find(p => p.id === productoAAgregar);
    if (!prod) return;
    const yaExiste = lineasEditadas.findIndex(l => l.producto_id === prod.id);
    if (yaExiste >= 0) {
      cambiarCantidad(yaExiste, lineasEditadas[yaExiste].cantidad + 1);
    } else {
      setLineasEditadas(prev => [...prev, {
        id: null, producto_id: prod.id,
        nombre_producto: prod.nombre, cantidad: 1,
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
        ? Math.max(0, datosEditados.paga_con - nuevoTotal) : null;

      const { error: errPedido } = await supabase
        .from('pedidos')
        .update({
          cliente_nombre: datosEditados.cliente_nombre,
          cliente_direccion: datosEditados.cliente_direccion,
          metodo_pago: datosEditados.metodo_pago,
          paga_con: datosEditados.paga_con > 0 ? datosEditados.paga_con : null,
          cambio: cambio, total: nuevoTotal
        })
        .eq('id', seleccionado.id);
      if (errPedido) throw errPedido;

      await supabase.from('lineas_pedido').delete().eq('pedido_id', seleccionado.id);

      const lineasNuevas = lineasValidas.map(l => ({
        pedido_id: seleccionado.id, producto_id: l.producto_id,
        nombre_producto: l.nombre_producto, cantidad: l.cantidad,
        precio_unitario: l.precio_unitario, restaurante_id: seleccionado.restaurante_id
      }));
      const { error: errLineas } = await supabase.from('lineas_pedido').insert(lineasNuevas);
      if (errLineas) throw errLineas;

      const horas = horasDesde(seleccionado.creado_en);
      const dentroDeVentana = horas <= HORAS_LIMITE_AVISO;

      if (avisarCliente && dentroDeVentana) {
        try {
          const resp = await fetch(BOT_URL + '/notificar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pedido_id: seleccionado.id })
          });
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            setMensajeEdicion('Pedido guardado, pero el aviso fallo: ' + (errData.error || 'desconocido'));
          } else {
            setMensajeEdicion('Pedido guardado y cliente avisado por WhatsApp.');
          }
        } catch (e) {
          setMensajeEdicion('Pedido guardado, pero no se pudo avisar al cliente.');
        }
      } else if (avisarCliente && !dentroDeVentana) {
        setMensajeEdicion('Pedido guardado, pero NO se aviso al cliente (han pasado mas de 24h).');
      } else {
        setMensajeEdicion('Pedido guardado (sin avisar al cliente).');
      }

      const { data: lineasFrescas } = await supabase
        .from('lineas_pedido').select('*').eq('pedido_id', seleccionado.id);
      setLineas(lineasFrescas || []);

      const { data: pedidoFresco } = await supabase
        .from('pedidos').select('*').eq('id', seleccionado.id).maybeSingle();
      if (pedidoFresco) setSeleccionado(pedidoFresco);

      setGuardandoEdicion(false);
      setEditando(false);
      setTimeout(() => setMensajeEdicion(''), 6000);

    } catch (e) {
      console.log('Error guardarCambios:', e);
      setMensajeEdicion('Error al guardar: ' + (e.message || 'desconocido'));
      setGuardandoEdicion(false);
    }
  }

  function imprimirComanda() { window.print(); }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/');
  }

  function formatearFecha(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
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
    if (pedido.metodo_pago === 'tarjeta') return '💳 Tarjeta';
    if (pedido.metodo_pago === 'pago_en_local') return '💰 Pago al recoger en local';
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

  const pedidosHoy = pedidos.filter(esDelDiaActual);

  const columnas = {
    recibidos: pedidosHoy.filter(p => columnaDe(p) === 'recibidos'),
    proceso: pedidosHoy.filter(p => columnaDe(p) === 'proceso'),
    finalizados: pedidosHoy.filter(p => columnaDe(p) === 'finalizados'),
  };

  function TarjetaPedido({ p }) {
    const est = infoEstado(p);
    const entrega = etiquetaEntrega(p);
    return (
      <button onClick={() => abrirPedido(p)}
        className="w-full text-left bg-white p-3 rounded-lg shadow-sm hover:shadow-md transition border border-gray-200">
        <div className="flex justify-between items-start mb-1">
          <span className="font-bold text-gray-900">#{p.id.slice(-4).toUpperCase()}</span>
          <span className="text-xs text-gray-400">{formatearHora(p.creado_en)}</span>
        </div>
        <div className="flex items-center gap-1 mb-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full ${entrega.clase}`}>{entrega.texto}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full ${est.color}`}>{est.label}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">{p.cliente_telefono}</span>
          <span className="font-semibold text-gray-900">{Number(p.total).toFixed(2)}€</span>
        </div>
      </button>
    );
  }

  const seEstaEditando = editando && seleccionado;
  const sePuedeEditar = seleccionado && seleccionado.estado !== 'entregado';
  const horasPedido = seleccionado ? horasDesde(seleccionado.creado_en) : 0;
  const dentroDeVentana24h = horasPedido <= HORAS_LIMITE_AVISO;

  return (
    <div className="min-h-screen">
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg" preload="auto" />

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
          .ticket { font-family: 'Courier New', monospace; font-size: 16pt; line-height: 1.35; font-weight: bold; }
          .ticket h1 { font-size: 28pt; text-align: center; margin: 0 0 4mm 0; }
          .ticket .separador { border-top: 2px dashed #000; margin: 3mm 0; }
          .ticket .grande { font-size: 20pt; font-weight: bold; }
          .ticket table { width: 100%; border-collapse: collapse; }
          .ticket table th, .ticket table td { text-align: left; padding: 1.5mm 0; font-size: 17pt; }
          .ticket table .col-cant { width: 14%; text-align: center; }
          .ticket table .col-prod { width: 58%; }
          .ticket table .col-tot { width: 28%; text-align: right; }
          .ticket .total { font-size: 22pt; font-weight: bold; text-align: right; margin-top: 2mm; }
        }
        @media screen { .solo-imprimir { display: none; } }
      `}</style>

      <header className="bg-white border-b shadow-sm no-imprimir">
        <div className="max-w-7xl mx-auto px-6 py-3 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {restaurante?.logo_url && (
              <img
                src={restaurante.logo_url}
                alt="Logo"
                className="w-10 h-10 rounded-lg object-cover bg-gray-100"
              />
            )}
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {restaurante?.nombre || 'Panel de Pedidos'}
              </h1>
              <p className="text-xs text-gray-500">Panel de pedidos</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden md:inline">{usuario?.email}</span>
            <a href="/carta" className="text-sm text-blue-600 hover:text-blue-700 font-medium">🍕 Carta</a>
            <a href="/horarios" className="text-sm text-blue-600 hover:text-blue-700 font-medium">🕐 Horarios</a>
            <a href="/ajustes" className="text-sm text-blue-600 hover:text-blue-700 font-medium">⚙️ Ajustes</a>
            {esAdmin && (
              <a href="/admin" className="text-sm text-blue-600 hover:text-blue-700 font-medium">🛡️ Admin</a>
            )}
            <button onClick={cerrarSesion} className="text-sm text-gray-600 hover:text-red-600">
              Salir
            </button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b no-imprimir">
        <div className="max-w-7xl mx-auto px-6 flex gap-4">
          <button
            onClick={() => setPestana('hoy')}
            className={`py-3 px-2 border-b-2 font-medium text-sm ${
              pestana === 'hoy'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📅 Hoy ({pedidosHoy.length})
          </button>
          <button
            onClick={() => setPestana('historial')}
            className={`py-3 px-2 border-b-2 font-medium text-sm ${
              pestana === 'historial'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📚 Historial
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-6 no-imprimir">
        {mensajeEdicion && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-4">{mensajeEdicion}</div>
        )}

        {pestana === 'hoy' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-100 rounded-xl p-3">
              <div className="mb-3 px-1">
                <h2 className="font-bold text-gray-900">🔴 Recibidos ({columnas.recibidos.length})</h2>
                <p className="text-xs text-gray-500">Hay que prepararlos</p>
              </div>
              <div className="space-y-2">
                {columnas.recibidos.length === 0 ? (
                  <p className="text-sm text-gray-400 px-1 py-4 text-center">Sin pedidos aquí</p>
                ) : (
                  columnas.recibidos.map(p => <TarjetaPedido key={p.id} p={p} />)
                )}
              </div>
            </div>

            <div className="bg-gray-100 rounded-xl p-3">
              <div className="mb-3 px-1">
                <h2 className="font-bold text-gray-900">🟡 En proceso ({columnas.proceso.length})</h2>
                <p className="text-xs text-gray-500">Listos o en reparto</p>
              </div>
              <div className="space-y-2">
                {columnas.proceso.length === 0 ? (
                  <p className="text-sm text-gray-400 px-1 py-4 text-center">Sin pedidos aquí</p>
                ) : (
                  columnas.proceso.map(p => <TarjetaPedido key={p.id} p={p} />)
                )}
              </div>
            </div>

            <div className="bg-gray-100 rounded-xl p-3">
              <button
                onClick={() => setFinalizadosAbierto(!finalizadosAbierto)}
                className="w-full text-left mb-3 px-1 flex items-center justify-between hover:bg-gray-200 rounded p-1 -m-1 transition"
              >
                <div>
                  <h2 className="font-bold text-gray-900">✅ Finalizados ({columnas.finalizados.length})</h2>
                  <p className="text-xs text-gray-500">Entregados o recogidos</p>
                </div>
                <span className="text-gray-500 text-lg">
                  {finalizadosAbierto ? '▼' : '▶'}
                </span>
              </button>
              {finalizadosAbierto && (
                <div className="space-y-2">
                  {columnas.finalizados.length === 0 ? (
                    <p className="text-sm text-gray-400 px-1 py-4 text-center">Sin pedidos aquí</p>
                  ) : (
                    columnas.finalizados.map(p => <TarjetaPedido key={p.id} p={p} />)
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {pestana === 'historial' && (
          <div>
            <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
              <div className="flex gap-3 flex-wrap">
                <input
                  type="text"
                  placeholder="Buscar por teléfono..."
                  value={filtroTelefono}
                  onChange={(e) => setFiltroTelefono(e.target.value)}
                  className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded"
                />
                <input
                  type="date"
                  value={filtroFecha}
                  onChange={(e) => setFiltroFecha(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded"
                />
                <button
                  onClick={cargarHistorial}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded"
                >
                  Buscar
                </button>
                <button
                  onClick={() => {
                    setFiltroTelefono('');
                    setFiltroFecha('');
                    setTimeout(cargarHistorial, 0);
                  }}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-4 py-2 rounded"
                >
                  Limpiar
                </button>
              </div>
            </div>

            {historialCargando ? (
              <p className="text-gray-500 text-center py-8">Cargando historial...</p>
            ) : historialPedidos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay pedidos que coincidan.</p>
            ) : (
              <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-left">
                    <tr>
                      <th className="py-3 px-4">Pedido</th>
                      <th className="py-3 px-4">Fecha</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Teléfono</th>
                      <th className="py-3 px-4">Entrega</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialPedidos.map(p => (
                      <tr key={p.id}
                        onClick={() => abrirPedido(p)}
                        className="border-t hover:bg-gray-50 cursor-pointer">
                        <td className="py-3 px-4 font-medium">#{p.id.slice(-4).toUpperCase()}</td>
                        <td className="py-3 px-4 text-gray-600">{formatearFecha(p.creado_en)}</td>
                        <td className="py-3 px-4">{p.cliente_nombre || '-'}</td>
                        <td className="py-3 px-4 text-gray-600">{telefonoLimpio(p.cliente_telefono)}</td>
                        <td className="py-3 px-4">{p.tipo_entrega === 'recogida' ? '🏪' : '🏠'}</td>
                        <td className="py-3 px-4 text-right font-medium">{Number(p.total).toFixed(2)}€</td>
                        <td className="py-3 px-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${infoEstado(p).color}`}>
                            {infoEstado(p).label}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {seleccionado && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 no-imprimir"
          style={{ backgroundColor: 'rgba(255,255,255,0.4)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
          onClick={cerrarDetalle}>
          <div className="bg-white w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {seEstaEditando ? 'Editar pedido' : 'Pedido'} #{seleccionado.id.slice(-4).toUpperCase()}
                </h2>
                <p className="text-gray-500 text-sm">{formatearFecha(seleccionado.creado_en)}</p>
              </div>
              <button onClick={cerrarDetalle} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
            </div>

            {seEstaEditando ? (
              <div>
                <div className="space-y-3 mb-6 text-sm">
                  <div>
                    <label className="text-gray-500 block mb-1">Nombre del cliente</label>
                    <input type="text" value={datosEditados.cliente_nombre}
                      onChange={(e) => actualizarDatos('cliente_nombre', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded" />
                  </div>
                  {seleccionado.tipo_entrega !== 'recogida' && (
                    <div>
                      <label className="text-gray-500 block mb-1">Dirección</label>
                      <input type="text" value={datosEditados.cliente_direccion}
                        onChange={(e) => actualizarDatos('cliente_direccion', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded" />
                    </div>
                  )}
                  <div>
                    <label className="text-gray-500 block mb-1">Método de pago</label>
                    <select value={datosEditados.metodo_pago}
                      onChange={(e) => actualizarDatos('metodo_pago', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded">
                      <option value="efectivo">Efectivo</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="pago_en_local">Pago en local</option>
                    </select>
                  </div>
                  {datosEditados.metodo_pago === 'efectivo' && (
                    <div>
                      <label className="text-gray-500 block mb-1">Paga con (€) — déjalo en 0 si es justo</label>
                      <input type="number" step="0.01" min="0" value={datosEditados.paga_con}
                        onChange={(e) => actualizarDatos('paga_con', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded" />
                    </div>
                  )}
                </div>

                <div className="border-t pt-4 mb-4">
                  <h3 className="font-semibold mb-3">Productos</h3>
                  <div className="space-y-2 mb-4">
                    {lineasEditadas.map((l, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                        <div className="flex-1 text-sm">
                          <p className="font-medium">{l.nombre_producto}</p>
                          <p className="text-gray-500 text-xs">{l.precio_unitario.toFixed(2)}€ / unidad</p>
                        </div>
                        <input type="number" min="0" value={l.cantidad}
                          onChange={(e) => cambiarCantidad(idx, e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm" />
                        <span className="text-sm w-16 text-right font-medium">
                          {(l.cantidad * l.precio_unitario).toFixed(2)}€
                        </span>
                        <button onClick={() => eliminarLinea(idx)}
                          className="text-red-500 hover:text-red-700 text-lg leading-none px-1" title="Eliminar">
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mb-2">
                    <select value={productoAAgregar}
                      onChange={(e) => setProductoAAgregar(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded text-sm">
                      <option value="">Añadir producto...</option>
                      {productosDisponibles.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.nombre} — {Number(p.precio).toFixed(2)}€
                        </option>
                      ))}
                    </select>
                    <button onClick={agregarProducto} disabled={!productoAAgregar}
                      className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded text-sm">
                      + Añadir
                    </button>
                  </div>
                </div>

                <div className="border-t pt-3 mb-4 flex justify-between font-bold text-lg">
                  <span>Total</span>
                  <span>{totalEditado().toFixed(2)}€</span>
                </div>

                {dentroDeVentana24h ? (
                  <label className="flex items-start gap-2 mb-4 text-sm cursor-pointer">
                    <input type="checkbox" checked={avisarCliente}
                      onChange={(e) => setAvisarCliente(e.target.checked)}
                      className="mt-1 w-4 h-4" />
                    <span>
                      <strong>Avisar al cliente por WhatsApp</strong> de los cambios.
                      {' '}<span className="text-gray-500">(Recomendado si has cambiado productos o el total)</span>
                    </span>
                  </label>
                ) : (
                  <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                    <p className="font-medium text-yellow-900">⚠️ No se puede avisar al cliente</p>
                    <p className="text-yellow-700 mt-1">
                      Han pasado más de 24 horas desde este pedido. Por las normas de WhatsApp,
                      el aviso automático no está disponible. Puedes guardar los cambios igualmente.
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={cancelarEdicion} disabled={guardandoEdicion}
                    className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 rounded-lg">
                    Cancelar
                  </button>
                  <button onClick={guardarCambios} disabled={guardandoEdicion}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-lg">
                    {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex gap-2 mb-6 flex-wrap items-center">
                  <span className={`text-sm px-3 py-1 rounded-full ${infoEstado(seleccionado).color}`}>
                    {infoEstado(seleccionado).label}
                  </span>
                  <span className={`text-sm px-3 py-1 rounded-full ${etiquetaEntrega(seleccionado).clase}`}>
                    {etiquetaEntrega(seleccionado).texto}
                  </span>
                  <button onClick={imprimirComanda}
                    className="ml-auto text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium px-3 py-1.5 rounded-lg">
                    🖨️ Imprimir
                  </button>
                  {sePuedeEditar && (
                    <button onClick={abrirEditor}
                      className="text-sm bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium px-3 py-1.5 rounded-lg">
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
                    <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent('tel:' + telefonoLimpio(seleccionado.cliente_telefono))}`}
                      alt="QR" width="90" height="90" className="rounded bg-white p-1" />
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
                  <button onClick={() => cambiarEstado(seleccionado, infoEstado(seleccionado).siguiente)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg">
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

      {seleccionado && !editando && (
        <div className="zona-imprimible solo-imprimir ticket">
          <h1>PEDIDO #{seleccionado.id.slice(-4).toUpperCase()}</h1>
          <p style={{ textAlign: 'center', margin: '0 0 3mm 0' }}>{formatearFecha(seleccionado.creado_en)}</p>
          {restaurante?.nombre && (
            <p style={{ textAlign: 'center', margin: '0 0 3mm 0', fontSize: '18pt' }}>{restaurante.nombre}</p>
          )}
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
            seleccionado.metodo_pago === 'pago_en_local' ? 'AL RECOGER' :
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

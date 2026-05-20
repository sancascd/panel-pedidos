'use client';

import { useState, useEffect, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  Sun, Moon, LogOut, Settings, Clock, UtensilsCrossed, Shield,
  Printer, Pencil, X, Plus, Trash2, Phone, Calendar, History,
  ChevronDown, ChevronRight, Loader2, AlertCircle, CheckCircle2,
  MapPin, CreditCard, Banknote, Store, Home, Filter, Search, Receipt, Star,
  ShoppingBag, Euro, TrendingUp, TrendingDown, Bell, BellOff, ChefHat
} from 'lucide-react';

const BOT_URL = 'https://bot-pedidos-production-f2b2.up.railway.app';
const HORAS_LIMITE_AVISO = 24;
const HORA_INICIO_DIA = 6;

const FLUJO_DOMICILIO = {
  recibido:   { label: 'Pedido recibido', tone: 'red',    siguiente: 'listo',      siguienteLabel: 'Marcar como listo' },
  listo:      { label: 'Listo',           tone: 'yellow', siguiente: 'en_reparto', siguienteLabel: 'Marcar en reparto' },
  en_reparto: { label: 'En reparto',      tone: 'blue',   siguiente: 'entregado',  siguienteLabel: 'Marcar como entregado' },
  entregado:  { label: 'Entregado',       tone: 'green',  siguiente: null,         siguienteLabel: null },
};

const FLUJO_RECOGIDA = {
  recibido:   { label: 'Pedido recibido',     tone: 'red',   siguiente: 'listo', siguienteLabel: 'Marcar como listo' },
  listo:      { label: 'Listo para recoger',  tone: 'green', siguiente: null,    siguienteLabel: null },
};

const TONE_CLASSES = {
  red:    'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  blue:   'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  green:  'bg-accent/10 text-accent border-accent/20',
  gray:   'bg-surface-2 text-text-muted border-border',
};

function flujoDe(pedido) {
  return pedido.tipo_entrega === 'recogida' ? FLUJO_RECOGIDA : FLUJO_DOMICILIO;
}

function infoEstado(pedido) {
  const flujo = flujoDe(pedido);
  return flujo[pedido.estado] || { label: pedido.estado, tone: 'gray', siguiente: null, siguienteLabel: null };
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

function estrellas(puntuacion) {
  const llenas = '★'.repeat(puntuacion);
  const vacias = '☆'.repeat(5 - puntuacion);
  return llenas + vacias;
}

function TicketImprimible({ pedido, lineas, restaurante, formatearFecha, telefonoLimpio }) {
  if (!pedido) return null;
  const pagoTexto = (() => {
    if (pedido.metodo_pago === 'tarjeta') return 'TARJETA';
    if (pedido.metodo_pago === 'pago_en_local') return 'AL RECOGER';
    if (pedido.metodo_pago === 'efectivo') {
      if (pedido.cambio && Number(pedido.cambio) > 0) {
        return 'EFECTIVO (paga con ' + Number(pedido.paga_con).toFixed(2) +
               'EUR, cambio ' + Number(pedido.cambio).toFixed(2) + 'EUR)';
      }
      return 'EFECTIVO (importe justo)';
    }
    return '-';
  })();

  return (
    <div className="ticket">
      <h1>PEDIDO #{pedido.id.slice(-4).toUpperCase()}</h1>
      <p style={{ textAlign: 'center', margin: '0 0 3mm 0' }}>{formatearFecha(pedido.creado_en)}</p>
      {restaurante?.nombre && (
        <p style={{ textAlign: 'center', margin: '0 0 3mm 0', fontSize: '18pt' }}>{restaurante.nombre}</p>
      )}
      <div className="separador"></div>
      <p className="grande">{pedido.tipo_entrega === 'recogida' ? 'RECOGIDA EN LOCAL' : 'A DOMICILIO'}</p>
      <div className="separador"></div>
      <p><strong>Cliente:</strong> {pedido.cliente_nombre || '-'}</p>
      <p><strong>Telefono:</strong> {telefonoLimpio(pedido.cliente_telefono)}</p>
      {pedido.tipo_entrega !== 'recogida' && (
        <p><strong>Direccion:</strong> {pedido.cliente_direccion || '-'}</p>
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
            <Fragment key={l.id}>
              <tr>
                <td className="col-cant">{l.cantidad}x</td>
                <td className="col-prod">{l.nombre_producto}</td>
                <td className="col-tot">{(l.cantidad * Number(l.precio_unitario)).toFixed(2)}€</td>
              </tr>
              {l.notas && l.notas.trim() !== '' && (
                <tr>
                  <td colSpan="3" className="nota">→ {l.notas}</td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <div className="separador"></div>
      <p className="total">TOTAL: {Number(pedido.total).toFixed(2)}€</p>
      <div className="separador"></div>
      <p><strong>Pago:</strong> {pagoTexto}</p>
      <div className="separador"></div>
      <p style={{ textAlign: 'center', fontSize: '10pt' }}>Gracias!</p>
    </div>
  );
}

function StatCard({ icono: Icono, label, valor, delta, deltaFormat, sublabel }) {
  let deltaContenido = null;
  let deltaClase = 'text-text-muted';
  let DeltaIcono = null;

  if (delta !== undefined && delta !== null && !isNaN(delta)) {
    const positivo = delta > 0;
    const cero = delta === 0;
    if (cero) {
      deltaClase = 'text-text-muted';
    } else if (positivo) {
      deltaClase = 'text-accent';
      DeltaIcono = TrendingUp;
    } else {
      deltaClase = 'text-red-500';
      DeltaIcono = TrendingDown;
    }
    deltaContenido = deltaFormat
      ? deltaFormat(delta)
      : (positivo ? '+' : '') + delta;
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icono className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-text tabular-nums">{valor}</p>
      {deltaContenido !== null ? (
        <div className={`flex items-center gap-1 mt-1 text-xs ${deltaClase}`}>
          {DeltaIcono && <DeltaIcono className="w-3 h-3" />}
          <span className="tabular-nums">{deltaContenido}</span>
          <span className="text-text-muted">vs ayer</span>
        </div>
      ) : sublabel ? (
        <p className="text-xs mt-1 text-text-muted">{sublabel}</p>
      ) : null}
    </div>
  );
}

export default function PaginaPedidos() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [usuario, setUsuario] = useState(null);
  const [restaurante, setRestaurante] = useState(null);
  const [pedidos, setPedidos] = useState([]);
  const [seleccionado, setSeleccionado] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [resena, setResena] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [modoOscuro, setModoOscuro] = useState(false);
  const [estadisticas, setEstadisticas] = useState(null);
  const [statsAbiertas, setStatsAbiertas] = useState(true);
  // 'default' | 'granted' | 'denied' | 'unsupported'
  const [permisoNotif, setPermisoNotif] = useState('default');
  // Estado para impresión en lote (varios pedidos a la vez)
  const [imprimiendoLote, setImprimiendoLote] = useState(false);
  const [pedidosLote, setPedidosLote] = useState([]);
  const [lineasLote, setLineasLote] = useState({}); // { pedidoId: [lineas] }

  const [pestana, setPestana] = useState('hoy');
  const [finalizadosAbierto, setFinalizadosAbierto] = useState(false);

  const [historialPedidos, setHistorialPedidos] = useState([]);
  const [historialCargando, setHistorialCargando] = useState(false);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [filtroProducto, setFiltroProducto] = useState('');
  const [filtroFechaDesde, setFiltroFechaDesde] = useState('');
  const [filtroFechaHasta, setFiltroFechaHasta] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const [editando, setEditando] = useState(false);
  const [productosDisponibles, setProductosDisponibles] = useState([]);
  const [lineasEditadas, setLineasEditadas] = useState([]);
  const [datosEditados, setDatosEditados] = useState(null);
  const [avisarCliente, setAvisarCliente] = useState(true);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [mensajeEdicion, setMensajeEdicion] = useState('');
  const [productoAAgregar, setProductoAAgregar] = useState('');

  const audioRef = useRef(null);

  // Inicializar modo oscuro según localStorage (sin depender del modo del sistema)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setModoOscuro(localStorage.getItem('theme') === 'dark');
  }, []);

  // Detectar el estado del permiso de notificaciones
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) {
      setPermisoNotif('unsupported');
    } else {
      setPermisoNotif(Notification.permission);
    }
  }, []);

  // Leer preferencia de stats abiertas/cerradas de localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const guardado = localStorage.getItem('stats-abiertas');
    if (guardado !== null) setStatsAbiertas(guardado === 'true');
  }, []);

  function alternarStats() {
    const nuevo = !statsAbiertas;
    setStatsAbiertas(nuevo);
    if (typeof window !== 'undefined') {
      localStorage.setItem('stats-abiertas', String(nuevo));
    }
  }

  async function solicitarPermisoNotif() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const permiso = await Notification.requestPermission();
      setPermisoNotif(permiso);
    } catch (e) {
      console.log('Error solicitando permiso de notificaciones:', e);
    }
  }

  function notificarPedido(pedido) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (!pedido || !pedido.id) return;

    const numero = '#' + pedido.id.slice(-4).toUpperCase();
    const total = pedido.total ? Number(pedido.total).toFixed(2) + '€' : '';
    const cliente = pedido.cliente_nombre || pedido.cliente_telefono?.replace('whatsapp:', '') || 'Cliente';
    const tipoEntrega = pedido.tipo_entrega === 'recogida' ? 'Recogida' : 'Domicilio';

    try {
      const notif = new Notification('Comandi · Nuevo pedido ' + numero, {
        body: cliente + ' · ' + total + ' · ' + tipoEntrega,
        tag: 'pedido-' + pedido.id,
        requireInteraction: false,
      });
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      console.log('Error mostrando notificación:', e);
    }
  }

  function alternarTema() {
    const nuevo = !modoOscuro;
    setModoOscuro(nuevo);
    if (nuevo) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setUsuario(session.user);
      const { data: admin } = await supabase.rpc('soy_superadmin');
      setEsAdmin(admin === true);

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
      await cargarEstadisticas();
      setCargando(false);
    }
    init();
  }, []);

  useEffect(() => {
    const canal = supabase.channel('pedidos-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, (payload) => {
        if (audioRef.current) audioRef.current.play().catch(() => {});
        if (payload?.new) notificarPedido(payload.new);
        cargarPedidos();
        cargarEstadisticas();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, () => {
        cargarPedidos();
        cargarEstadisticas();
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, []);

  async function cargarPedidos() {
    const { data } = await supabase
      .from('pedidos').select('*')
      .order('creado_en', { ascending: true }).limit(500);
    setPedidos(data || []);
  }

  async function cargarEstadisticas() {
    const inicioHoy = inicioDiaTrabajo();
    const inicioAyer = inicioHoy - 24 * 60 * 60 * 1000;
    const inicioAyerISO = new Date(inicioAyer).toISOString();

    const { data } = await supabase
      .from('pedidos')
      .select('total, creado_en, entregado_en, estado')
      .gte('creado_en', inicioAyerISO);

    if (!data) {
      setEstadisticas({
        pedidosHoy: 0, deltaPedidos: 0,
        ingresosHoy: 0, deltaIngresos: 0,
        ticketMedioHoy: 0, tiempoMedio: null
      });
      return;
    }

    const hoy = data.filter(p => new Date(p.creado_en).getTime() >= inicioHoy);
    const ayer = data.filter(p => {
      const t = new Date(p.creado_en).getTime();
      return t >= inicioAyer && t < inicioHoy;
    });

    const sumar = arr => arr.reduce((s, p) => s + Number(p.total || 0), 0);
    const ingresosHoy = sumar(hoy);
    const ingresosAyer = sumar(ayer);

    // Tiempo medio de preparación: entregado_en - creado_en (en minutos) de los entregados hoy
    const entregadosHoy = hoy.filter(p => p.entregado_en);
    let tiempoMedio = null;
    if (entregadosHoy.length > 0) {
      const totalMs = entregadosHoy.reduce((s, p) => {
        return s + (new Date(p.entregado_en).getTime() - new Date(p.creado_en).getTime());
      }, 0);
      tiempoMedio = Math.round(totalMs / entregadosHoy.length / 1000 / 60);
    }

    setEstadisticas({
      pedidosHoy: hoy.length,
      deltaPedidos: hoy.length - ayer.length,
      ingresosHoy: ingresosHoy,
      deltaIngresos: ingresosHoy - ingresosAyer,
      ticketMedioHoy: hoy.length > 0 ? ingresosHoy / hoy.length : 0,
      tiempoMedio: tiempoMedio
    });
  }

  async function cargarHistorial() {
    setHistorialCargando(true);

    // Si hay filtro de producto, hacemos inner join con lineas_pedido
    const usaProducto = filtroProducto.trim() !== '';
    let query = supabase.from('pedidos');

    if (usaProducto) {
      query = query.select('*, lineas_pedido!inner(nombre_producto)');
      query = query.ilike('lineas_pedido.nombre_producto', '%' + filtroProducto.trim() + '%');
    } else {
      query = query.select('*');
    }

    query = query.order('creado_en', { ascending: false });

    // Búsqueda por nombre o teléfono (OR)
    if (filtroBusqueda.trim()) {
      const q = filtroBusqueda.trim().replace(/[,()]/g, '');
      query = query.or(`cliente_nombre.ilike.%${q}%,cliente_telefono.ilike.%${q}%`);
    }

    // Rango de fechas
    if (filtroFechaDesde) {
      const inicio = new Date(filtroFechaDesde + 'T00:00:00');
      query = query.gte('creado_en', inicio.toISOString());
    }
    if (filtroFechaHasta) {
      const fin = new Date(filtroFechaHasta + 'T23:59:59');
      query = query.lte('creado_en', fin.toISOString());
    }

    // Estado concreto
    if (filtroEstado) {
      query = query.eq('estado', filtroEstado);
    }

    query = query.limit(200);

    const { data } = await query;
    setHistorialPedidos(data || []);
    setHistorialCargando(false);
  }

  function limpiarFiltros() {
    setFiltroBusqueda('');
    setFiltroProducto('');
    setFiltroFechaDesde('');
    setFiltroFechaHasta('');
    setFiltroEstado('');
    setTimeout(cargarHistorial, 0);
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
    const { data: resenaData } = await supabase
      .from('resenas').select('*').eq('pedido_id', pedido.id).maybeSingle();
    setResena(resenaData || null);
  }

  function cerrarDetalle() {
    setSeleccionado(null);
    setLineas([]);
    setResena(null);
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
      cantidad: l.cantidad, precio_unitario: Number(l.precio_unitario),
      notas: l.notas || ''
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

  function cambiarNota(index, nuevaNota) {
    setLineasEditadas(prev => {
      const copia = [...prev];
      copia[index] = { ...copia[index], notas: nuevaNota };
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
        precio_unitario: Number(prod.precio),
        notas: ''
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
        precio_unitario: l.precio_unitario, restaurante_id: seleccionado.restaurante_id,
        notas: l.notas && l.notas.trim() !== '' ? l.notas.trim() : null
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
            setMensajeEdicion('Pedido guardado, pero el aviso falló: ' + (errData.error || 'desconocido'));
          } else {
            setMensajeEdicion('Pedido guardado y cliente avisado por WhatsApp.');
          }
        } catch (e) {
          setMensajeEdicion('Pedido guardado, pero no se pudo avisar al cliente.');
        }
      } else if (avisarCliente && !dentroDeVentana) {
        setMensajeEdicion('Pedido guardado, pero NO se avisó al cliente (han pasado más de 24h).');
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

  async function imprimirLotePendientes() {
    const pendientes = pedidos
      .filter(esDelDiaActual)
      .filter(p => columnaDe(p) !== 'finalizados');
    if (pendientes.length === 0) return;

    const ids = pendientes.map(p => p.id);
    const { data: lineas } = await supabase
      .from('lineas_pedido').select('*').in('pedido_id', ids);

    const porPedido = {};
    (lineas || []).forEach(l => {
      if (!porPedido[l.pedido_id]) porPedido[l.pedido_id] = [];
      porPedido[l.pedido_id].push(l);
    });

    setPedidosLote(pendientes);
    setLineasLote(porPedido);
    setImprimiendoLote(true);

    // Esperamos al render antes de lanzar la impresión
    setTimeout(() => {
      window.print();
      // Después de cerrar el diálogo de impresión, limpiamos
      setTimeout(() => {
        setImprimiendoLote(false);
        setPedidosLote([]);
        setLineasLote({});
      }, 500);
    }, 100);
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
    router.push('/login');
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

  function iconoEntrega(pedido) {
    return pedido.tipo_entrega === 'recogida' ? Store : Home;
  }

  function textoEntrega(pedido) {
    return pedido.tipo_entrega === 'recogida' ? 'Recogida' : 'Domicilio';
  }

  function iconoPago(metodo) {
    if (metodo === 'tarjeta') return CreditCard;
    if (metodo === 'pago_en_local') return Store;
    return Banknote;
  }

  function textoPago(pedido) {
    if (pedido.metodo_pago === 'tarjeta') return 'Tarjeta';
    if (pedido.metodo_pago === 'pago_en_local') return 'Pago al recoger en local';
    if (pedido.metodo_pago === 'efectivo') {
      if (pedido.cambio && Number(pedido.cambio) > 0) {
        return 'Efectivo · paga con ' + Number(pedido.paga_con).toFixed(2) +
               '€ · cambio ' + Number(pedido.cambio).toFixed(2) + '€';
      }
      return 'Efectivo · importe justo';
    }
    return 'No especificado';
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
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
    const IconoEntrega = iconoEntrega(p);

    return (
      <button
        onClick={() => abrirPedido(p)}
        className="group w-full text-left card p-3.5 hover:shadow-lift hover:border-accent/30 transition-all duration-200 animate-fade-in"
      >
        <div className="flex justify-between items-start mb-2">
          <span className="font-semibold text-sm text-text tabular-nums">
            #{p.id.slice(-4).toUpperCase()}
          </span>
          <span className="text-xs text-text-muted tabular-nums">
            {formatearHora(p.creado_en)}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <span className="badge bg-surface-2 text-text-muted border border-border">
            <IconoEntrega className="w-3 h-3" />
            {textoEntrega(p)}
          </span>
          <span className={`badge border ${TONE_CLASSES[est.tone]}`}>
            {est.label}
          </span>
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-border">
          <span className="text-xs text-text-muted tabular-nums">{telefonoLimpio(p.cliente_telefono)}</span>
          <span className="text-base font-semibold text-text tabular-nums">
            {Number(p.total).toFixed(2)}€
          </span>
        </div>
      </button>
    );
  }

  const seEstaEditando = editando && seleccionado;
  const sePuedeEditar = seleccionado && seleccionado.estado !== 'entregado';
  const horasPedido = seleccionado ? horasDesde(seleccionado.creado_en) : 0;
  const dentroDeVentana24h = horasPedido <= HORAS_LIMITE_AVISO;

  return (
    <div className="min-h-screen bg-bg">
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
          .ticket table th, .ticket table td { text-align: left; padding: 1.5mm 0; font-size: 17pt; vertical-align: top; }
          .ticket table .col-cant { width: 14%; text-align: center; }
          .ticket table .col-prod { width: 58%; }
          .ticket table .col-tot { width: 28%; text-align: right; }
          .ticket .nota { font-size: 14pt; font-style: italic; padding-left: 4mm; }
          .ticket .total { font-size: 22pt; font-weight: bold; text-align: right; margin-top: 2mm; }
          /* Corte entre tickets cuando se imprimen varios en lote */
          .ticket + .ticket { page-break-before: always; break-before: page; }
        }
        @media screen { .solo-imprimir { display: none; } }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border no-imprimir">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo + nombre del restaurante */}
          <div className="flex items-center gap-3 min-w-0">
            {restaurante?.logo_url ? (
              <img
                src={restaurante.logo_url}
                alt="Logo"
                className="w-9 h-9 rounded-lg object-cover bg-surface-2 border border-border flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                <UtensilsCrossed className="w-4 h-4 text-accent" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-text truncate">
                {restaurante?.nombre || 'Comandi'}
              </h1>
              <p className="text-xs text-text-muted hidden sm:block">Panel de pedidos</p>
            </div>
          </div>

          {/* Navegación */}
          <nav className="flex items-center gap-1">
            <a href="/cocina" className="nav-link hidden md:inline-flex" title="Vista cocina">
              <ChefHat className="w-4 h-4" />
              <span className="hidden lg:inline">Cocina</span>
            </a>
            <a href="/carta" className="nav-link hidden md:inline-flex" title="Carta">
              <UtensilsCrossed className="w-4 h-4" />
              <span className="hidden lg:inline">Carta</span>
            </a>
            <a href="/horarios" className="nav-link hidden md:inline-flex" title="Horarios">
              <Clock className="w-4 h-4" />
              <span className="hidden lg:inline">Horarios</span>
            </a>
            <a href="/resenas" className="nav-link hidden md:inline-flex" title="Reseñas">
              <Star className="w-4 h-4" />
              <span className="hidden lg:inline">Reseñas</span>
            </a>
            <a href="/ajustes" className="nav-link hidden md:inline-flex" title="Ajustes">
              <Settings className="w-4 h-4" />
              <span className="hidden lg:inline">Ajustes</span>
            </a>
            {esAdmin && (
              <a href="/admin" className="nav-link hidden md:inline-flex" title="Admin">
                <Shield className="w-4 h-4" />
                <span className="hidden lg:inline">Admin</span>
              </a>
            )}

            <div className="h-6 w-px bg-border mx-1 hidden md:block" />

            <button
              onClick={alternarTema}
              className="btn-ghost p-2"
              title={modoOscuro ? 'Modo claro' : 'Modo oscuro'}
            >
              {modoOscuro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={cerrarSesion}
              className="btn-ghost p-2"
              title="Cerrar sesión"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </nav>
        </div>

        {/* Menú móvil compacto */}
        <div className="md:hidden border-t border-border px-4 py-2 flex gap-1 overflow-x-auto">
          <a href="/cocina" className="nav-link whitespace-nowrap">
            <ChefHat className="w-4 h-4" />Cocina
          </a>
          <a href="/carta" className="nav-link whitespace-nowrap">
            <UtensilsCrossed className="w-4 h-4" />Carta
          </a>
          <a href="/horarios" className="nav-link whitespace-nowrap">
            <Clock className="w-4 h-4" />Horarios
          </a>
          <a href="/resenas" className="nav-link whitespace-nowrap">
            <Star className="w-4 h-4" />Reseñas
          </a>
          <a href="/ajustes" className="nav-link whitespace-nowrap">
            <Settings className="w-4 h-4" />Ajustes
          </a>
          {esAdmin && (
            <a href="/admin" className="nav-link whitespace-nowrap">
              <Shield className="w-4 h-4" />Admin
            </a>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-border bg-bg no-imprimir">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1">
          <button
            onClick={() => setPestana('hoy')}
            className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
              pestana === 'hoy'
                ? 'border-accent text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Hoy
            <span className="ml-1 tabular-nums text-xs px-1.5 py-0.5 rounded-md bg-surface-2 text-text-muted">
              {pedidosHoy.length}
            </span>
          </button>
          <button
            onClick={() => setPestana('historial')}
            className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
              pestana === 'historial'
                ? 'border-accent text-text'
                : 'border-transparent text-text-muted hover:text-text'
            }`}
          >
            <History className="w-4 h-4" />
            Historial
          </button>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 no-imprimir">
        {mensajeEdicion && (
          <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm animate-fade-in">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{mensajeEdicion}</span>
          </div>
        )}

        {permisoNotif === 'default' && (
          <div className="mb-4 card p-4 flex items-center gap-3 bg-accent/5 border-accent/20 animate-fade-in">
            <Bell className="w-5 h-5 text-accent flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text">Activa las notificaciones</p>
              <p className="text-xs text-text-muted mt-0.5">
                Te avisamos al instante cuando entre un pedido, incluso si tienes la pestaña en segundo plano.
              </p>
            </div>
            <button onClick={solicitarPermisoNotif} className="btn-primary flex-shrink-0">
              Activar
            </button>
          </div>
        )}

        {permisoNotif === 'denied' && (
          <div className="mb-4 card p-3 flex items-center gap-3 bg-surface-2/50 border-border">
            <BellOff className="w-4 h-4 text-text-muted flex-shrink-0" />
            <p className="text-xs text-text-muted flex-1">
              Tienes las notificaciones bloqueadas. Para activarlas, haz clic en el candado del navegador → Notificaciones → Permitir.
            </p>
          </div>
        )}

        {pestana === 'hoy' && estadisticas && (
          <div className="mb-6">
            <button
              onClick={alternarStats}
              className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-surface-2/50 border border-border hover:border-accent/30 transition-colors"
              aria-expanded={statsAbiertas}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <TrendingUp className="w-4 h-4 text-accent flex-shrink-0" />
                <span className="text-sm font-medium text-text">Estadísticas del día</span>
                {!statsAbiertas && (
                  <span className="text-xs text-text-muted ml-2 tabular-nums truncate hidden sm:inline">
                    {estadisticas.pedidosHoy} pedidos · {estadisticas.ingresosHoy.toFixed(2)}€
                  </span>
                )}
              </div>
              <ChevronDown
                className={`w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-200 ${
                  statsAbiertas ? 'rotate-180' : ''
                }`}
              />
            </button>

            {statsAbiertas && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3 animate-fade-in">
                <StatCard
                  icono={ShoppingBag}
                  label="Pedidos hoy"
                  valor={estadisticas.pedidosHoy}
                  delta={estadisticas.deltaPedidos}
                />
                <StatCard
                  icono={Euro}
                  label="Ingresos hoy"
                  valor={`${estadisticas.ingresosHoy.toFixed(2)}€`}
                  delta={estadisticas.deltaIngresos}
                  deltaFormat={(d) => `${d > 0 ? '+' : ''}${d.toFixed(2)}€`}
                />
                <StatCard
                  icono={Receipt}
                  label="Ticket medio"
                  valor={`${estadisticas.ticketMedioHoy.toFixed(2)}€`}
                  sublabel={estadisticas.pedidosHoy > 0 ? 'por pedido' : 'sin pedidos hoy'}
                />
                <StatCard
                  icono={Clock}
                  label="Tiempo medio"
                  valor={estadisticas.tiempoMedio !== null ? `${estadisticas.tiempoMedio} min` : '—'}
                  sublabel={estadisticas.tiempoMedio !== null ? 'de preparación' : 'sin entregas hoy'}
                />
              </div>
            )}
          </div>
        )}

        {pestana === 'hoy' && (() => {
          const pendientesCount = pedidos.filter(esDelDiaActual).filter(p => columnaDe(p) !== 'finalizados').length;
          return pendientesCount > 0 ? (
            <div className="mb-4 flex justify-end">
              <button
                onClick={imprimirLotePendientes}
                className="btn-secondary text-sm"
                title="Imprimir todos los pedidos pendientes"
              >
                <Printer className="w-4 h-4" />
                Imprimir pendientes ({pendientesCount})
              </button>
            </div>
          ) : null;
        })()}

        {pestana === 'hoy' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Columna RECIBIDOS */}
            <div className="bg-surface-2/50 rounded-xl p-3 border border-border">
              <div className="mb-3 px-1 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse-soft" />
                    <h2 className="text-sm font-semibold text-text">Recibidos</h2>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Hay que prepararlos</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface text-text-muted tabular-nums">
                  {columnas.recibidos.length}
                </span>
              </div>
              <div className="space-y-2">
                {columnas.recibidos.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-text-muted">Sin pedidos nuevos</p>
                  </div>
                ) : (
                  columnas.recibidos.map(p => <TarjetaPedido key={p.id} p={p} />)
                )}
              </div>
            </div>

            {/* Columna EN PROCESO */}
            <div className="bg-surface-2/50 rounded-xl p-3 border border-border">
              <div className="mb-3 px-1 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <h2 className="text-sm font-semibold text-text">En proceso</h2>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Listos o en reparto</p>
                </div>
                <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface text-text-muted tabular-nums">
                  {columnas.proceso.length}
                </span>
              </div>
              <div className="space-y-2">
                {columnas.proceso.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-text-muted">Sin pedidos en proceso</p>
                  </div>
                ) : (
                  columnas.proceso.map(p => <TarjetaPedido key={p.id} p={p} />)
                )}
              </div>
            </div>

            {/* Columna FINALIZADOS (plegable) */}
            <div className="bg-surface-2/50 rounded-xl p-3 border border-border">
              <button
                onClick={() => setFinalizadosAbierto(!finalizadosAbierto)}
                className="w-full mb-3 px-1 flex items-center justify-between hover:bg-surface rounded-lg p-2 -m-1 transition-colors"
              >
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent" />
                    <h2 className="text-sm font-semibold text-text">Finalizados</h2>
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Entregados o recogidos</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-md bg-surface text-text-muted tabular-nums">
                    {columnas.finalizados.length}
                  </span>
                  {finalizadosAbierto ?
                    <ChevronDown className="w-4 h-4 text-text-muted" /> :
                    <ChevronRight className="w-4 h-4 text-text-muted" />
                  }
                </div>
              </button>
              {finalizadosAbierto && (
                <div className="space-y-2 animate-fade-in">
                  {columnas.finalizados.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-text-muted">Sin pedidos finalizados</p>
                    </div>
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
            <div className="card p-4 mb-4 space-y-3">
              {/* Fila 1: búsquedas de texto */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Nombre o teléfono..."
                    value={filtroBusqueda}
                    onChange={(e) => setFiltroBusqueda(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') cargarHistorial(); }}
                    className="input pl-9"
                  />
                </div>
                <div className="relative">
                  <UtensilsCrossed className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Producto..."
                    value={filtroProducto}
                    onChange={(e) => setFiltroProducto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') cargarHistorial(); }}
                    className="input pl-9"
                  />
                </div>
              </div>

              {/* Fila 2: rango de fechas y estado */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-text-muted mb-1 ml-1">Desde</label>
                  <input
                    type="date"
                    value={filtroFechaDesde}
                    onChange={(e) => setFiltroFechaDesde(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1 ml-1">Hasta</label>
                  <input
                    type="date"
                    value={filtroFechaHasta}
                    onChange={(e) => setFiltroFechaHasta(e.target.value)}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs text-text-muted mb-1 ml-1">Estado</label>
                  <select
                    value={filtroEstado}
                    onChange={(e) => setFiltroEstado(e.target.value)}
                    className="input"
                  >
                    <option value="">Todos los estados</option>
                    <option value="recibido">Recibido</option>
                    <option value="listo">Listo</option>
                    <option value="en_reparto">En reparto</option>
                    <option value="entregado">Entregado</option>
                  </select>
                </div>
              </div>

              {/* Fila 3: botones */}
              <div className="flex gap-2 pt-1">
                <button onClick={cargarHistorial} className="btn-primary">
                  <Filter className="w-4 h-4" />
                  Buscar
                </button>
                <button onClick={limpiarFiltros} className="btn-secondary">
                  Limpiar filtros
                </button>
                <span className="text-xs text-text-muted ml-auto self-center tabular-nums">
                  {historialPedidos.length} {historialPedidos.length === 1 ? 'resultado' : 'resultados'}
                </span>
              </div>
            </div>

            {historialCargando ? (
              <div className="py-12 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto" />
              </div>
            ) : historialPedidos.length === 0 ? (
              <div className="py-12 text-center text-text-muted">
                <Receipt className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No hay pedidos que coincidan.</p>
              </div>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-text-muted text-left text-xs uppercase tracking-wide">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Pedido</th>
                      <th className="py-3 px-4 font-semibold">Fecha</th>
                      <th className="py-3 px-4 font-semibold">Cliente</th>
                      <th className="py-3 px-4 font-semibold">Teléfono</th>
                      <th className="py-3 px-4 font-semibold">Entrega</th>
                      <th className="py-3 px-4 font-semibold text-right">Total</th>
                      <th className="py-3 px-4 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialPedidos.map(p => {
                      const est = infoEstado(p);
                      const IconoEntrega = iconoEntrega(p);
                      return (
                        <tr key={p.id}
                          onClick={() => abrirPedido(p)}
                          className="border-t border-border hover:bg-surface-2/50 cursor-pointer transition-colors">
                          <td className="py-3 px-4 font-semibold tabular-nums">#{p.id.slice(-4).toUpperCase()}</td>
                          <td className="py-3 px-4 text-text-muted tabular-nums">{formatearFecha(p.creado_en)}</td>
                          <td className="py-3 px-4">{p.cliente_nombre || '-'}</td>
                          <td className="py-3 px-4 text-text-muted tabular-nums">{telefonoLimpio(p.cliente_telefono)}</td>
                          <td className="py-3 px-4">
                            <IconoEntrega className="w-4 h-4 text-text-muted" />
                          </td>
                          <td className="py-3 px-4 text-right font-medium tabular-nums">{Number(p.total).toFixed(2)}€</td>
                          <td className="py-3 px-4">
                            <span className={`badge border ${TONE_CLASSES[est.tone]}`}>
                              {est.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal de detalle / edición */}
      {seleccionado && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 no-imprimir animate-fade-in"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={cerrarDetalle}
        >
          <div
            className="bg-surface w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-border shadow-lift animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-text">
                  {seEstaEditando ? 'Editar pedido' : 'Pedido'} #{seleccionado.id.slice(-4).toUpperCase()}
                </h2>
                <p className="text-xs text-text-muted mt-0.5 tabular-nums">{formatearFecha(seleccionado.creado_en)}</p>
              </div>
              <button
                onClick={cerrarDetalle}
                className="btn-ghost p-1.5"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {seEstaEditando ? (
                <div>
                  <div className="space-y-3 mb-6">
                    <div>
                      <label className="label">Nombre del cliente</label>
                      <input
                        type="text"
                        value={datosEditados.cliente_nombre}
                        onChange={(e) => actualizarDatos('cliente_nombre', e.target.value)}
                        className="input"
                      />
                    </div>
                    {seleccionado.tipo_entrega !== 'recogida' && (
                      <div>
                        <label className="label">Dirección</label>
                        <input
                          type="text"
                          value={datosEditados.cliente_direccion}
                          onChange={(e) => actualizarDatos('cliente_direccion', e.target.value)}
                          className="input"
                        />
                      </div>
                    )}
                    <div>
                      <label className="label">Método de pago</label>
                      <select
                        value={datosEditados.metodo_pago}
                        onChange={(e) => actualizarDatos('metodo_pago', e.target.value)}
                        className="input"
                      >
                        <option value="efectivo">Efectivo</option>
                        <option value="tarjeta">Tarjeta</option>
                        <option value="pago_en_local">Pago en local</option>
                      </select>
                    </div>
                    {datosEditados.metodo_pago === 'efectivo' && (
                      <div>
                        <label className="label">Paga con (€) — déjalo en 0 si es justo</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={datosEditados.paga_con}
                          onChange={(e) => actualizarDatos('paga_con', parseFloat(e.target.value) || 0)}
                          className="input"
                        />
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-4 mb-4">
                    <h3 className="text-sm font-semibold text-text mb-3">Productos</h3>
                    <div className="space-y-2 mb-4">
                      {lineasEditadas.map((l, idx) => (
                        <div key={idx} className="bg-surface-2 p-3 rounded-lg">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text truncate">{l.nombre_producto}</p>
                              <p className="text-xs text-text-muted tabular-nums">{l.precio_unitario.toFixed(2)}€ / unidad</p>
                            </div>
                            <input
                              type="number"
                              min="0"
                              value={l.cantidad}
                              onChange={(e) => cambiarCantidad(idx, e.target.value)}
                              className="input w-16 text-center text-sm py-1.5"
                            />
                            <span className="text-sm w-16 text-right font-medium tabular-nums">
                              {(l.cantidad * l.precio_unitario).toFixed(2)}€
                            </span>
                            <button
                              onClick={() => eliminarLinea(idx)}
                              className="btn-ghost p-1.5 hover:text-red-500"
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={l.notas || ''}
                            onChange={(e) => cambiarNota(idx, e.target.value)}
                            placeholder="Notas (ej: sin cebolla, extra queso...)"
                            className="input w-full mt-2 text-xs italic py-1.5"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <select
                        value={productoAAgregar}
                        onChange={(e) => setProductoAAgregar(e.target.value)}
                        className="input flex-1"
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
                        className="btn-primary"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-border pt-3 mb-4 flex justify-between items-baseline">
                    <span className="text-sm font-medium text-text-muted">Total</span>
                    <span className="text-2xl font-bold text-text tabular-nums">{totalEditado().toFixed(2)}€</span>
                  </div>

                  {dentroDeVentana24h ? (
                    <label className="flex items-start gap-2 mb-4 text-sm cursor-pointer p-3 rounded-lg bg-surface-2 border border-border hover:border-accent/30 transition-colors">
                      <input
                        type="checkbox"
                        checked={avisarCliente}
                        onChange={(e) => setAvisarCliente(e.target.checked)}
                        className="mt-0.5 w-4 h-4 accent-accent"
                      />
                      <span className="text-text">
                        <strong className="font-medium">Avisar al cliente por WhatsApp</strong> de los cambios.
                        {' '}<span className="text-text-muted">(Recomendado si has cambiado productos o el total)</span>
                      </span>
                    </label>
                  ) : (
                    <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-medium text-yellow-700 dark:text-yellow-400">No se puede avisar al cliente</p>
                          <p className="text-yellow-700/80 dark:text-yellow-400/80 mt-1">
                            Han pasado más de 24 horas desde este pedido. Por las normas de WhatsApp,
                            el aviso automático no está disponible.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={cancelarEdicion}
                      disabled={guardandoEdicion}
                      className="btn-secondary flex-1"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={guardarCambios}
                      disabled={guardandoEdicion}
                      className="btn-primary flex-1"
                    >
                      {guardandoEdicion ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Guardando...
                        </>
                      ) : (
                        'Guardar cambios'
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex gap-2 mb-6 flex-wrap items-center">
                    <span className={`badge border ${TONE_CLASSES[infoEstado(seleccionado).tone]}`}>
                      {infoEstado(seleccionado).label}
                    </span>
                    <span className="badge bg-surface-2 text-text-muted border border-border">
                      {(() => {
                        const IconoE = iconoEntrega(seleccionado);
                        return (
                          <>
                            <IconoE className="w-3 h-3" />
                            {textoEntrega(seleccionado)}
                          </>
                        );
                      })()}
                    </span>
                    <div className="ml-auto flex gap-1">
                      <button onClick={imprimirComanda} className="btn-ghost" title="Imprimir">
                        <Printer className="w-4 h-4" />
                      </button>
                      {sePuedeEditar && (
                        <button onClick={abrirEditor} className="btn-ghost" title="Editar pedido">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    <div className="flex items-start gap-3">
                      <Phone className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-muted">Teléfono</p>
                        <p className="text-sm font-medium text-text tabular-nums">{telefonoLimpio(seleccionado.cliente_telefono)}</p>
                      </div>
                    </div>

                    <div className="bg-surface-2 rounded-lg p-3 flex items-center gap-3 border border-border">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent('tel:' + telefonoLimpio(seleccionado.cliente_telefono))}`}
                        alt="QR"
                        width="80"
                        height="80"
                        className="rounded bg-white p-1.5 flex-shrink-0"
                      />
                      <div className="text-sm min-w-0">
                        <p className="font-medium text-text">Llamar al cliente</p>
                        <p className="text-xs text-text-muted">Escanea con la cámara del móvil.</p>
                        <a
                          href={`tel:${telefonoLimpio(seleccionado.cliente_telefono)}`}
                          className="text-xs font-medium text-accent hover:text-accent-hover transition-colors"
                        >
                          O pulsa aquí para llamar
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <UtensilsCrossed className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-muted">Cliente</p>
                        <p className="text-sm font-medium text-text">{seleccionado.cliente_nombre || '-'}</p>
                      </div>
                    </div>

                    {seleccionado.tipo_entrega !== 'recogida' ? (
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-text-muted">Dirección</p>
                          <p className="text-sm font-medium text-text">{seleccionado.cliente_direccion || '-'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-3">
                        <Store className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-text-muted">Tipo</p>
                          <p className="text-sm font-medium text-text">El cliente recoge en el local</p>
                        </div>
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      {(() => {
                        const Icono = iconoPago(seleccionado.metodo_pago);
                        return <Icono className="w-4 h-4 text-text-muted mt-0.5 flex-shrink-0" />;
                      })()}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-muted">Pago</p>
                        <p className="text-sm font-medium text-text">{textoPago(seleccionado)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border pt-4 mb-6">
                    <h3 className="text-sm font-semibold text-text mb-3">Productos</h3>
                    <div className="space-y-2">
                      {lineas.map(l => (
                        <div key={l.id} className="pb-3 border-b border-border last:border-b-0 last:pb-0">
                          <div className="flex justify-between text-sm">
                            <span className="flex-1 text-text">
                              <span className="font-semibold tabular-nums">{l.cantidad}×</span> {l.nombre_producto}
                            </span>
                            <span className="font-medium text-text tabular-nums">{(l.cantidad * l.precio_unitario).toFixed(2)}€</span>
                          </div>
                          {l.notas && l.notas.trim() !== '' && (
                            <p className="text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-md px-2 py-1 mt-1.5 italic">
                              {l.notas}
                            </p>
                          )}
                        </div>
                      ))}
                      <div className="flex justify-between items-baseline pt-3 border-t border-border">
                        <span className="text-sm font-medium text-text-muted">Total</span>
                        <span className="text-2xl font-bold text-text tabular-nums">{Number(seleccionado.total).toFixed(2)}€</span>
                      </div>
                    </div>
                  </div>

                  {resena && (
                    <div className="border-t border-border pt-4 mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Star className="w-4 h-4 text-accent" />
                        <h3 className="text-sm font-semibold text-text">Reseña del cliente</h3>
                      </div>
                      <div className="bg-surface-2 rounded-lg p-3 border border-border">
                        <p className="text-yellow-500 text-lg tabular-nums mb-1">
                          {estrellas(resena.puntuacion)}
                        </p>
                        {resena.comentario && (
                          <p className="text-sm text-text italic mb-1">"{resena.comentario}"</p>
                        )}
                        <p className="text-xs text-text-muted tabular-nums">
                          {formatearFecha(resena.creado_en)}
                        </p>
                      </div>
                    </div>
                  )}

                  {infoEstado(seleccionado).siguiente ? (
                    <button
                      onClick={() => cambiarEstado(seleccionado, infoEstado(seleccionado).siguiente)}
                      className="btn-primary w-full"
                    >
                      {infoEstado(seleccionado).siguienteLabel}
                    </button>
                  ) : (
                    <div className="w-full text-center py-3 rounded-lg bg-surface-2 text-text-muted text-sm font-medium border border-border">
                      Pedido finalizado
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Zona imprimible (ticket) — soporta tanto el pedido seleccionado
          como el lote de pedidos pendientes */}
      {((seleccionado && !editando) || imprimiendoLote) && (
        <div className="zona-imprimible solo-imprimir">
          {imprimiendoLote
            ? pedidosLote.map(p => (
                <TicketImprimible
                  key={p.id}
                  pedido={p}
                  lineas={lineasLote[p.id] || []}
                  restaurante={restaurante}
                  formatearFecha={formatearFecha}
                  telefonoLimpio={telefonoLimpio}
                />
              ))
            : (
              <TicketImprimible
                pedido={seleccionado}
                lineas={lineas}
                restaurante={restaurante}
                formatearFecha={formatearFecha}
                telefonoLimpio={telefonoLimpio}
              />
            )}
        </div>
      )}
    </div>
  );
}

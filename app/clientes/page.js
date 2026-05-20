'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  ArrowLeft, Users, Loader2, AlertCircle, CheckCircle2,
  Send, Search, Sparkles, X, Megaphone, ShieldAlert
} from 'lucide-react';

const BOT_URL = 'https://bot-pedidos-production-f2b2.up.railway.app';

// Plantillas de marketing predefinidas, diseñadas para cumplir las políticas
// de Meta WhatsApp Business. {{nombre_cliente}} lo rellena el bot por cada
// destinatario; el resto de variables las rellena el restaurante.
const PLANTILLAS = [
  {
    id: 'oferta-del-dia',
    nombre: 'Oferta del día',
    descripcion: 'Para anunciar una promoción puntual de hoy',
    cuerpo: 'Hola {{nombre_cliente}}, hoy en {{nombre_restaurante}} tenemos una oferta especial: {{descripcion_oferta}}. Si te interesa, escríbenos y la preparamos.',
    variables: [
      { key: 'descripcion_oferta', label: 'Qué ofreces', placeholder: 'Hamburguesa BBQ + bebida por 8,90€', maxLength: 200 }
    ]
  },
  {
    id: 'dia-evento',
    nombre: 'Día especial / Evento',
    descripcion: 'Días de partido, festivos, eventos locales',
    cuerpo: 'Hola {{nombre_cliente}}, en {{nombre_restaurante}} celebramos {{nombre_evento}} con {{oferta}}. Te esperamos.',
    variables: [
      { key: 'nombre_evento', label: 'Nombre del evento o día', placeholder: 'el partido de mañana', maxLength: 100 },
      { key: 'oferta', label: 'Qué ofreces ese día', placeholder: 'un menú especial con cerveza incluida', maxLength: 200 }
    ]
  },
  {
    id: 'producto-nuevo',
    nombre: 'Nuevo producto en carta',
    descripcion: 'Anuncio de algo nuevo que has añadido',
    cuerpo: 'Hola {{nombre_cliente}}, novedad en {{nombre_restaurante}}: {{producto_nuevo}}. Si quieres probarlo, pídelo cuando quieras.',
    variables: [
      { key: 'producto_nuevo', label: 'Qué producto es nuevo', placeholder: 'la hamburguesa de la casa con queso curado', maxLength: 200 }
    ]
  },
  {
    id: 'descuento-limitado',
    nombre: 'Descuento por tiempo limitado',
    descripcion: 'Descuento o promoción con caducidad',
    cuerpo: 'Hola {{nombre_cliente}}, esta semana en {{nombre_restaurante}} tienes {{descuento}} en {{en_que_aplica}}. Válido hasta {{fecha_fin}}.',
    variables: [
      { key: 'descuento', label: 'Descuento (ej: 20%, 5€...)', placeholder: '20% de descuento', maxLength: 50 },
      { key: 'en_que_aplica', label: 'En qué aplica', placeholder: 'toda la carta', maxLength: 100 },
      { key: 'fecha_fin', label: 'Hasta cuándo', placeholder: 'el domingo', maxLength: 50 }
    ]
  },
  {
    id: 'reapertura',
    nombre: 'Reapertura / Vuelta tras cierre',
    descripcion: 'Anuncio de que vuelves a estar abierto',
    cuerpo: 'Hola {{nombre_cliente}}, en {{nombre_restaurante}} ya estamos de vuelta: abrimos {{fecha_apertura}}. Te esperamos.',
    variables: [
      { key: 'fecha_apertura', label: 'Cuándo abres', placeholder: 'mañana lunes', maxLength: 100 }
    ]
  }
];

function resolverPlantilla(plantilla, valores, nombreRestaurante) {
  let texto = plantilla.cuerpo;
  texto = texto.replace(/{{nombre_restaurante}}/g, nombreRestaurante || 'nosotros');
  plantilla.variables.forEach(v => {
    const valor = (valores[v.key] || '').trim();
    texto = texto.replace(new RegExp('{{' + v.key + '}}', 'g'), valor);
  });
  return texto;
}

function telefonoLimpio(tel) {
  if (!tel) return '';
  return tel.replace('whatsapp:', '').replace(/\s/g, '').trim();
}

function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function diasDesde(iso) {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / 1000 / 60 / 60 / 24);
}

export default function PaginaClientes() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [restauranteId, setRestauranteId] = useState(null);
  const [restauranteNombre, setRestauranteNombre] = useState('');
  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroOptin, setFiltroOptin] = useState('todos'); // 'todos' | 'optin' | 'no_optin'
  const [campanasEsteMes, setCampanasEsteMes] = useState(0);
  const [mensaje, setMensaje] = useState('');

  // Estado del modal de campaña
  const [modalAbierto, setModalAbierto] = useState(false);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('');
  const [valoresVariables, setValoresVariables] = useState({});
  const [enviandoCampana, setEnviandoCampana] = useState(false);
  const [resultadoCampana, setResultadoCampana] = useState(null);

  const MAX_CAMPANAS_MES = 2;

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) { setCargando(false); return; }
      setRestauranteId(restId);
      // Cargar nombre del restaurante para usarlo en las plantillas
      const { data: rest } = await supabase
        .from('restaurantes').select('nombre').eq('id', restId).maybeSingle();
      if (rest?.nombre) setRestauranteNombre(rest.nombre);
      await cargarTodo(restId);
      setCargando(false);
    }
    init();
  }, []);

  async function cargarTodo(restId) {
    await Promise.all([cargarClientes(restId), cargarCampanasEsteMes(restId)]);
  }

  async function cargarClientes(restId) {
    // Cargar clientes y pedidos en paralelo, luego agregar
    const [clientesRes, pedidosRes] = await Promise.all([
      supabase.from('clientes').select('*').eq('restaurante_id', restId),
      supabase.from('pedidos').select('cliente_telefono, total, creado_en').eq('restaurante_id', restId)
    ]);

    const pedidosPorTel = {};
    (pedidosRes.data || []).forEach(p => {
      if (!pedidosPorTel[p.cliente_telefono]) pedidosPorTel[p.cliente_telefono] = [];
      pedidosPorTel[p.cliente_telefono].push(p);
    });

    const clientesAgregados = (clientesRes.data || []).map(c => {
      const sus = pedidosPorTel[c.telefono] || [];
      const totalPedidos = sus.length;
      const totalGastado = sus.reduce((s, p) => s + Number(p.total || 0), 0);
      return {
        ...c,
        totalPedidos,
        totalGastado,
        ticketMedio: totalPedidos > 0 ? totalGastado / totalPedidos : 0,
      };
    });

    // Ordenar por total gastado descendente
    clientesAgregados.sort((a, b) => b.totalGastado - a.totalGastado);
    setClientes(clientesAgregados);
  }

  async function cargarCampanasEsteMes(restId) {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from('campanas_marketing')
      .select('*', { count: 'exact', head: true })
      .eq('restaurante_id', restId)
      .gte('creado_en', inicioMes.toISOString());
    setCampanasEsteMes(count || 0);
  }

  async function toggleOptin(cliente) {
    const nuevoValor = !cliente.acepta_marketing;
    // Si vamos a ACTIVAR marketing manualmente, pedir confirmación expresa al
    // restaurante (RGPD: debe haber consentimiento real del cliente).
    if (nuevoValor) {
      const confirmar = confirm(
        '¿Confirmas que ' + (cliente.nombre || 'este cliente') + ' te ha dado consentimiento expreso ' +
        '(verbal, escrito, o por WhatsApp) para recibir mensajes promocionales?\n\n' +
        'Activar esta opción sin consentimiento real del cliente viola el RGPD y las políticas de Meta. ' +
        'El restaurante es legalmente responsable.\n\n' +
        'Lo normal es que el cliente active el opt-in desde WhatsApp escribiendo MARKETING SI.'
      );
      if (!confirmar) return;
    }
    // Optimistic update
    setClientes(prev => prev.map(c =>
      c.telefono === cliente.telefono
        ? { ...c, acepta_marketing: nuevoValor, marketing_consultado_en: new Date().toISOString() }
        : c
    ));
    const { error } = await supabase
      .from('clientes')
      .update({
        acepta_marketing: nuevoValor,
        marketing_consultado_en: new Date().toISOString()
      })
      .eq('restaurante_id', restauranteId)
      .eq('telefono', cliente.telefono);
    if (error) {
      // Revertir si falla
      setClientes(prev => prev.map(c =>
        c.telefono === cliente.telefono ? { ...c, acepta_marketing: !nuevoValor } : c
      ));
      avisar('Error al actualizar el permiso de marketing');
    }
  }

  function avisar(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 4000);
  }

  function abrirModalCampana() {
    setPlantillaSeleccionada('');
    setValoresVariables({});
    setResultadoCampana(null);
    setModalAbierto(true);
  }

  function obtenerPlantilla() {
    return PLANTILLAS.find(p => p.id === plantillaSeleccionada);
  }

  function plantillaCompleta() {
    const plantilla = obtenerPlantilla();
    if (!plantilla) return false;
    return plantilla.variables.every(v => (valoresVariables[v.key] || '').trim() !== '');
  }

  function vistaPrevia(ejemploNombre = 'María') {
    const plantilla = obtenerPlantilla();
    if (!plantilla) return '';
    let texto = resolverPlantilla(plantilla, valoresVariables, restauranteNombre);
    texto = texto.replace(/{{nombre_cliente}}/g, ejemploNombre);
    return texto;
  }

  async function enviarCampana() {
    const plantilla = obtenerPlantilla();
    if (!plantilla || !plantillaCompleta()) return;
    setEnviandoCampana(true);
    setResultadoCampana(null);
    // Texto con todo resuelto excepto {{nombre_cliente}} (lo rellena el bot por cliente)
    const contenidoBase = resolverPlantilla(plantilla, valoresVariables, restauranteNombre);
    try {
      const resp = await fetch(BOT_URL + '/enviar-campana', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurante_id: restauranteId,
          contenido: contenidoBase,
          plantilla_id: plantilla.id
        })
      });
      const data = await resp.json();
      setResultadoCampana({ ok: resp.ok, ...data });
      if (resp.ok) {
        await cargarCampanasEsteMes(restauranteId);
      }
    } catch (e) {
      setResultadoCampana({ ok: false, error: e.message });
    } finally {
      setEnviandoCampana(false);
    }
  }

  // Filtrar clientes
  const clientesFiltrados = clientes.filter(c => {
    if (filtroOptin === 'optin' && !c.acepta_marketing) return false;
    if (filtroOptin === 'no_optin' && c.acepta_marketing) return false;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      const nombre = (c.nombre || '').toLowerCase();
      const tel = telefonoLimpio(c.telefono).toLowerCase();
      return nombre.includes(q) || tel.includes(q);
    }
    return true;
  });

  const totalClientes = clientes.length;
  const clientesOptin = clientes.filter(c => c.acepta_marketing).length;
  const totalIngresos = clientes.reduce((s, c) => s + c.totalGastado, 0);

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const campanasRestantes = MAX_CAMPANAS_MES - campanasEsteMes;
  const puedeEnviarCampanas = campanasRestantes > 0 && clientesOptin > 0;

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Clientes</h1>
              <p className="text-xs text-text-muted hidden sm:block">Lista de clientes y campañas de marketing</p>
            </div>
          </div>
          <a href="/pedidos" className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {mensaje && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm animate-fade-in">
            <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{mensaje}</span>
          </div>
        )}

        {/* Stats arriba */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Total clientes</p>
            <p className="text-2xl font-bold text-text tabular-nums">{totalClientes}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Con marketing</p>
            <p className="text-2xl font-bold text-text tabular-nums">{clientesOptin}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Ingresos totales</p>
            <p className="text-2xl font-bold text-text tabular-nums">{totalIngresos.toFixed(2)}€</p>
          </div>
          <div className="card p-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Campañas este mes</p>
            <p className="text-2xl font-bold text-text tabular-nums">{campanasEsteMes}/{MAX_CAMPANAS_MES}</p>
          </div>
        </div>

        {/* Info sobre cómo funciona el opt-in (RGPD) */}
        <details className="card p-4">
          <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium text-text">
            <ShieldAlert className="w-4 h-4 text-accent" />
            <span>Cómo funciona el permiso de marketing (RGPD)</span>
          </summary>
          <div className="mt-3 pl-6 text-sm text-text-muted space-y-2 leading-relaxed">
            <p>
              <strong className="text-text">Lo normal:</strong> el cliente activa el opt-in escribiéndote por WhatsApp
              <span className="font-mono mx-1 px-1.5 py-0.5 rounded bg-surface-2 text-text">MARKETING SI</span>
              (el bot lo registra automáticamente). El cliente puede darse de baja escribiendo
              <span className="font-mono mx-1 px-1.5 py-0.5 rounded bg-surface-2 text-text">BAJA</span>.
            </p>
            <p>
              <strong className="text-text">Excepción:</strong> si un cliente te da consentimiento expreso en persona o por escrito,
              puedes activarlo aquí desde el toggle. Tú asumes la responsabilidad legal del consentimiento.
            </p>
            <p>
              <strong className="text-text">Sin consentimiento, no se envían mensajes.</strong> Comandi solo enviará la campaña a los clientes que aparezcan como "Activo" en esta tabla.
            </p>
          </div>
        </details>

        {/* Botón de campaña */}
        <div className="card p-5 flex items-start gap-4 bg-gradient-to-br from-surface to-accent/5 border-accent/20">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-5 h-5 text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-text mb-1">Enviar mensaje de marketing</h2>
            <p className="text-sm text-text-muted">
              Envía un mensaje a tus {clientesOptin} cliente{clientesOptin !== 1 ? 's' : ''} con marketing activado.
              Te quedan <strong className="text-text">{campanasRestantes}</strong> campaña{campanasRestantes !== 1 ? 's' : ''} este mes.
            </p>
            {clientesOptin === 0 && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                Aún no hay clientes con marketing activado. Actívalo desde la columna 'Marketing' de la tabla.
              </p>
            )}
          </div>
          <button
            onClick={abrirModalCampana}
            disabled={!puedeEnviarCampanas}
            className="btn-primary flex-shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva campaña</span>
            <span className="sm:hidden">Enviar</span>
          </button>
        </div>

        {/* Filtros */}
        <div className="card p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar por nombre o teléfono..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="input pl-9"
              />
            </div>
            <select
              value={filtroOptin}
              onChange={(e) => setFiltroOptin(e.target.value)}
              className="input w-auto"
            >
              <option value="todos">Todos los clientes</option>
              <option value="optin">Con marketing activado</option>
              <option value="no_optin">Sin marketing</option>
            </select>
            <span className="text-xs text-text-muted tabular-nums ml-auto">
              {clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'cliente' : 'clientes'}
            </span>
          </div>
        </div>

        {/* Tabla de clientes */}
        {clientesFiltrados.length === 0 ? (
          <div className="card p-12 text-center">
            <Users className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
            <p className="text-text-muted">
              {clientes.length === 0
                ? 'Aún no tienes clientes registrados. Cuando alguien haga un pedido, aparecerá aquí.'
                : 'No hay clientes que coincidan con los filtros.'}
            </p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-text-muted text-left text-xs uppercase tracking-wide">
                <tr>
                  <th className="py-3 px-4 font-semibold">Cliente</th>
                  <th className="py-3 px-4 font-semibold">Teléfono</th>
                  <th className="py-3 px-4 font-semibold text-right">Pedidos</th>
                  <th className="py-3 px-4 font-semibold text-right">Total gastado</th>
                  <th className="py-3 px-4 font-semibold text-right">Ticket medio</th>
                  <th className="py-3 px-4 font-semibold">Último pedido</th>
                  <th className="py-3 px-4 font-semibold text-center">Marketing</th>
                </tr>
              </thead>
              <tbody>
                {clientesFiltrados.map(c => {
                  const dias = diasDesde(c.ultimo_pedido_en);
                  return (
                    <tr key={c.telefono} className="border-t border-border hover:bg-surface-2/50 transition-colors">
                      <td className="py-3 px-4 font-medium text-text">{c.nombre || '—'}</td>
                      <td className="py-3 px-4 text-text-muted tabular-nums">{telefonoLimpio(c.telefono)}</td>
                      <td className="py-3 px-4 text-right tabular-nums">{c.totalPedidos}</td>
                      <td className="py-3 px-4 text-right tabular-nums font-medium">{c.totalGastado.toFixed(2)}€</td>
                      <td className="py-3 px-4 text-right tabular-nums text-text-muted">{c.ticketMedio.toFixed(2)}€</td>
                      <td className="py-3 px-4 text-text-muted">
                        {formatearFecha(c.ultimo_pedido_en)}
                        {dias !== null && dias <= 7 && (
                          <span className="ml-1.5 text-xs text-accent">(hace {dias === 0 ? 'hoy' : dias + 'd'})</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => toggleOptin(c)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                            c.acepta_marketing
                              ? 'bg-accent/10 text-accent border-accent/20 hover:bg-accent/20'
                              : 'bg-surface-2 text-text-muted border-border hover:border-accent/30'
                          }`}
                          title={c.acepta_marketing ? 'Dar de baja' : 'Activar (requiere consentimiento del cliente)'}
                        >
                          {c.acepta_marketing ? 'Activo' : 'Sin permiso'}
                        </button>
                        {c.marketing_consultado_en && (
                          <p className="text-[10px] text-text-muted mt-1 tabular-nums">
                            {formatearFecha(c.marketing_consultado_en)}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Modal de campaña */}
      {modalAbierto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4 animate-fade-in"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => !enviandoCampana && setModalAbierto(false)}
        >
          <div
            className="bg-surface w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-border shadow-lift animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-semibold text-text">Nueva campaña</h2>
                <p className="text-xs text-text-muted mt-0.5">
                  Se enviará a {clientesOptin} cliente{clientesOptin !== 1 ? 's' : ''} con marketing activado
                </p>
              </div>
              <button onClick={() => !enviandoCampana && setModalAbierto(false)} className="btn-ghost p-1.5">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {!resultadoCampana && (
                <>
                  {/* Aviso de cumplimiento de Meta */}
                  <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3 flex items-start gap-2 text-sm">
                    <ShieldAlert className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="text-yellow-700 dark:text-yellow-400 text-xs">
                      <p className="font-medium mb-1 text-sm">Mensajes seguros por diseño</p>
                      <p>
                        Solo puedes elegir entre plantillas pre-diseñadas para cumplir las políticas de
                        Meta WhatsApp Business. Te quedan <strong>{campanasRestantes}</strong> campaña{campanasRestantes !== 1 ? 's' : ''} este mes.
                      </p>
                    </div>
                  </div>

                  {/* Selector de plantilla */}
                  <div>
                    <label className="label">Tipo de mensaje</label>
                    <select
                      value={plantillaSeleccionada}
                      onChange={(e) => {
                        setPlantillaSeleccionada(e.target.value);
                        setValoresVariables({});
                      }}
                      className="input"
                      disabled={enviandoCampana}
                    >
                      <option value="">Elige una plantilla...</option>
                      {PLANTILLAS.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </select>
                    {plantillaSeleccionada && (
                      <p className="text-xs text-text-muted mt-1.5">
                        {obtenerPlantilla()?.descripcion}
                      </p>
                    )}
                  </div>

                  {/* Variables a rellenar */}
                  {plantillaSeleccionada && obtenerPlantilla()?.variables.map(v => (
                    <div key={v.key}>
                      <label className="label">{v.label}</label>
                      <input
                        type="text"
                        value={valoresVariables[v.key] || ''}
                        onChange={(e) => setValoresVariables({ ...valoresVariables, [v.key]: e.target.value })}
                        className="input"
                        placeholder={v.placeholder}
                        maxLength={v.maxLength}
                        disabled={enviandoCampana}
                      />
                    </div>
                  ))}

                  {/* Vista previa */}
                  {plantillaSeleccionada && plantillaCompleta() && (
                    <div className="rounded-lg bg-surface-2 border border-border p-3">
                      <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                        Vista previa (con un nombre de ejemplo)
                      </p>
                      <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">
                        {vistaPrevia()}
                      </p>
                    </div>
                  )}
                </>
              )}

              {resultadoCampana && resultadoCampana.ok && (
                <div className="rounded-lg bg-accent/10 border border-accent/20 p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-accent mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-text mb-1">Campaña enviada</p>
                      <p className="text-text-muted">
                        Enviada a <strong className="text-text">{resultadoCampana.num_enviados}</strong> de {resultadoCampana.num_destinatarios} clientes.
                        {resultadoCampana.num_fallidos > 0 && (
                          <> {resultadoCampana.num_fallidos} fallidos (probablemente fuera de la ventana de 24h).</>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {resultadoCampana && !resultadoCampana.ok && (
                <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="text-red-600 dark:text-red-400">
                      <p className="font-medium mb-1">No se pudo enviar</p>
                      <p>{resultadoCampana.error || 'Error desconocido'}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {!resultadoCampana ? (
                  <>
                    <button onClick={() => setModalAbierto(false)} disabled={enviandoCampana} className="btn-secondary flex-1">
                      Cancelar
                    </button>
                    <button
                      onClick={enviarCampana}
                      disabled={enviandoCampana || !plantillaCompleta() || !puedeEnviarCampanas}
                      className="btn-primary flex-1"
                    >
                      {enviandoCampana ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Enviar campaña
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <button onClick={() => setModalAbierto(false)} className="btn-primary w-full">
                    Cerrar
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

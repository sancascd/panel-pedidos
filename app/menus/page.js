'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import MenuNav from '@/components/MenuNav';
import { mejorPlato, leerLinea, proponerPlatos } from '@/lib/enlazarCarta';
import {
  ArrowLeft, Plus, Pencil, Trash2, Check, X, ClipboardList,
  Loader2, AlertCircle, ChevronDown, ChevronRight, Search
} from 'lucide-react';

const DIAS = [
  { num: 1, corto: 'L', largo: 'Lunes' },
  { num: 2, corto: 'M', largo: 'Martes' },
  { num: 3, corto: 'X', largo: 'Miércoles' },
  { num: 4, corto: 'J', largo: 'Jueves' },
  { num: 5, corto: 'V', largo: 'Viernes' },
  { num: 6, corto: 'S', largo: 'Sábado' },
  { num: 7, corto: 'D', largo: 'Domingo' },
];

// Una lista de WhatsApp admite 10 filas. Por encima de eso el grupo se sirve en
// dos niveles (por subapartado), y si tampoco hay subapartados no hay forma de
// enseñarlo entero: por eso el aviso es distinto en cada caso.
const MAX_FILAS_LISTA = 10;

export default function PaginaMenus() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [restauranteId, setRestauranteId] = useState(null);
  const [menus, setMenus] = useState([]);
  const [grupos, setGrupos] = useState({});      // menu_id -> [grupo]
  const [opciones, setOpciones] = useState({});  // grupo_id -> [opcion]
  const [platos, setPlatos] = useState({});      // menu_id -> [plato fijo]
  const [propuestas, setPropuestas] = useState({}); // menu_id -> propuesta retocada a mano
  const [productos, setProductos] = useState([]);
  const [mensaje, setMensaje] = useState('');

  const [abiertos, setAbiertos] = useState({});
  const [editandoMenu, setEditandoMenu] = useState(null);
  const [datosMenu, setDatosMenu] = useState(null);
  const [nuevoGrupoEn, setNuevoGrupoEn] = useState(null);
  const [nombreGrupo, setNombreGrupo] = useState('');
  const [anadiendoEn, setAnadiendoEn] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [subgrupoNuevo, setSubgrupoNuevo] = useState('');

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) { avisar('No tienes restaurante asignado.'); setCargando(false); return; }
      setRestauranteId(restId);
      await Promise.all([cargarTodo(restId), cargarProductos(restId)]);
      setCargando(false);
    }
    init();
  }, []);

  function avisar(t) { setMensaje(t); setTimeout(() => setMensaje(''), 4000); }

  async function cargarProductos(restId) {
    const { data } = await supabase
      .from('productos').select('id, nombre, precio, numero')
      .eq('restaurante_id', restId).eq('disponible', true);
    setProductos((data || []).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')));
  }

  // Los tres niveles de golpe: son pocas filas y evita una cascada de consultas
  // (y de estados a medio cargar) cada vez que se despliega un menú.
  async function cargarTodo(restId) {
    const id = restId || restauranteId;
    const { data: ms } = await supabase
      .from('menus').select('*').eq('restaurante_id', id).order('orden');
    const { data: gs } = await supabase
      .from('menu_grupos').select('*').eq('restaurante_id', id).order('orden');
    const { data: os } = await supabase
      .from('menu_opciones').select('*').eq('restaurante_id', id).order('orden');

    // Lo que incluye cada menú cerrado. Si la tabla aún no existe viene error y
    // se sigue sin platos fijos, como antes.
    const { data: ps } = await supabase
      .from('menu_platos').select('*').eq('restaurante_id', id).order('orden');

    const porMenu = {}; const porGrupo = {}; const platosPorMenu = {};
    (gs || []).forEach(g => { (porMenu[g.menu_id] = porMenu[g.menu_id] || []).push(g); });
    (os || []).forEach(o => { (porGrupo[o.grupo_id] = porGrupo[o.grupo_id] || []).push(o); });
    (ps || []).forEach(p => { (platosPorMenu[p.menu_id] = platosPorMenu[p.menu_id] || []).push(p); });
    setMenus(ms || []);
    setGrupos(porMenu);
    setOpciones(porGrupo);
    setPlatos(platosPorMenu);
  }

  // ---------- menús ----------
  function nuevoMenu() {
    setEditandoMenu('nuevo');
    setDatosMenu({ nombre: '', descripcion: '', precio: '', dias_semana: [1, 2, 3, 4, 5], turno: 'manana', activo: true });
  }

  function editarMenu(m) {
    setEditandoMenu(m.id);
    setDatosMenu({
      nombre: m.nombre || '', descripcion: m.descripcion || '',
      precio: String(m.precio ?? ''), dias_semana: m.dias_semana || [],
      turno: m.turno || '', activo: m.activo,
    });
  }

  async function guardarMenu() {
    const precio = Number(String(datosMenu.precio).replace(',', '.'));
    if (!datosMenu.nombre.trim()) { avisar('El menú necesita un nombre.'); return; }
    if (!isFinite(precio) || precio <= 0) { avisar('Pon un precio válido.'); return; }

    const fila = {
      restaurante_id: restauranteId,
      nombre: datosMenu.nombre.trim(),
      descripcion: datosMenu.descripcion.trim() || null,
      precio,
      dias_semana: datosMenu.dias_semana,
      turno: datosMenu.turno || null,
      activo: datosMenu.activo,
    };
    const { error } = editandoMenu === 'nuevo'
      ? await supabase.from('menus').insert({ ...fila, orden: menus.length + 1 })
      : await supabase.from('menus').update(fila).eq('id', editandoMenu);
    if (error) { avisar('Error: ' + error.message); return; }
    setEditandoMenu(null); setDatosMenu(null);
    await cargarTodo();
  }

  async function borrarMenu(m) {
    if (!confirm('¿Borrar "' + m.nombre + '" con todos sus grupos y opciones?')) return;
    const { error } = await supabase.from('menus').delete().eq('id', m.id);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarTodo();
  }

  async function alternarActivo(m) {
    const { error } = await supabase.from('menus').update({ activo: !m.activo }).eq('id', m.id);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarTodo();
  }

  // ---------- grupos ----------
  async function crearGrupo(menuId) {
    if (!nombreGrupo.trim()) return;
    const orden = (grupos[menuId] || []).length + 1;
    const { error } = await supabase.from('menu_grupos').insert({
      menu_id: menuId, restaurante_id: restauranteId, nombre: nombreGrupo.trim(), orden,
    });
    if (error) { avisar('Error: ' + error.message); return; }
    setNombreGrupo(''); setNuevoGrupoEn(null);
    await cargarTodo();
  }

  async function borrarGrupo(g) {
    if (!confirm('¿Borrar el grupo "' + g.nombre + '" y sus opciones?')) return;
    const { error } = await supabase.from('menu_grupos').delete().eq('id', g.id);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarTodo();
  }

  // ---------- opciones ----------
  async function anadirOpcion(grupoId, producto) {
    const orden = (opciones[grupoId] || []).length + 1;
    const { error } = await supabase.from('menu_opciones').insert({
      grupo_id: grupoId, restaurante_id: restauranteId,
      producto_id: producto.id, nombre: producto.nombre,
      subgrupo: subgrupoNuevo.trim() || null,
      orden,
    });
    if (error) { avisar('Error: ' + error.message); return; }
    setBusqueda('');
    await cargarTodo();
  }

  // Hay platos que solo existen DENTRO del menú: el tiramisú, la macedonia, el
  // café… Muchos restaurantes no los venden sueltos, así que no están en la
  // carta y no habría forma de meterlos. Van sin producto_id (y por tanto sin
  // número de plato), pero salen en el ticket igual.
  async function anadirOpcionLibre(grupoId) {
    const nombre = busqueda.trim();
    if (!nombre) return;
    const orden = (opciones[grupoId] || []).length + 1;
    const { error } = await supabase.from('menu_opciones').insert({
      grupo_id: grupoId, restaurante_id: restauranteId,
      producto_id: null, nombre,
      subgrupo: subgrupoNuevo.trim() || null,
      orden,
    });
    if (error) { avisar('Error: ' + error.message); return; }
    setBusqueda('');
    await cargarTodo();
  }

  async function borrarOpcion(o) {
    const { error } = await supabase.from('menu_opciones').delete().eq('id', o.id);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarTodo();
  }

  async function cambiarSuplemento(o, valor) {
    const n = Number(String(valor).replace(',', '.')) || 0;
    const { error } = await supabase.from('menu_opciones').update({ suplemento: n }).eq('id', o.id);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarTodo();
  }

  // ---------- lo que incluye un menú cerrado ----------
  // Un menú sin grupos no tiene nada que elegir, pero cocina tiene que saber
  // qué lleva y con qué número de plato: por eso cada plato se enlaza a la
  // carta. Lo que no está en la carta (bebida, postre) va sin número.
  // Se puede escribir "2 rollos de primavera": el 2 es la cantidad.
  async function anadirPlato(menuId, producto, cantidad = 1) {
    const nombre = producto ? producto.nombre : leerLinea(busqueda).texto;
    if (!nombre) return;
    const orden = (platos[menuId] || []).length + 1;
    const { error } = await supabase.from('menu_platos').insert({
      menu_id: menuId, restaurante_id: restauranteId,
      producto_id: producto ? producto.id : null, nombre,
      cantidad: Math.min(99, Math.max(1, cantidad)), orden,
    });
    if (error) { avisar('Error: ' + error.message); return; }
    setBusqueda('');
    await cargarTodo();
  }

  async function borrarPlato(p) {
    const { error } = await supabase.from('menu_platos').delete().eq('id', p.id);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarTodo();
  }

  async function cambiarCantidad(p, valor) {
    const n = Math.min(99, Math.max(1, parseInt(valor, 10) || 1));
    if (n === Number(p.cantidad)) return;
    const { error } = await supabase.from('menu_platos').update({ cantidad: n }).eq('id', p.id);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarTodo();
  }

  const numeroDeProducto = (id) => (id && productos.find(p => p.id === id)?.numero) || '';

  // ---------- enlazar solo con la carta ----------
  // Lo que se propone para un menú cerrado a partir de su descripción, con los
  // retoques que se hayan hecho a mano encima.
  const propuestaDe = (m) => propuestas[m.id] || proponerPlatos(m.descripcion, productos);

  function cambiarPropuesta(m, i, productoId) {
    const prop = propuestaDe(m).slice();
    prop[i] = { ...prop[i], producto: productos.find(p => p.id === productoId) || null, seguro: true };
    setPropuestas(prev => ({ ...prev, [m.id]: prop }));
  }

  function filasDePropuesta(menuId, propuesta) {
    const base = (platos[menuId] || []).length;
    return propuesta.map((p, i) => ({
      menu_id: menuId, restaurante_id: restauranteId,
      producto_id: p.producto ? p.producto.id : null,
      nombre: p.producto ? p.producto.nombre : p.texto,
      cantidad: Math.min(99, Math.max(1, p.cantidad)),
      orden: base + i + 1,
    }));
  }

  async function guardarPropuesta(m) {
    const { error } = await supabase.from('menu_platos').insert(filasDePropuesta(m.id, propuestaDe(m)));
    if (error) { avisar('Error: ' + error.message); return; }
    setPropuestas(prev => { const n = { ...prev }; delete n[m.id]; return n; });
    await cargarTodo();
  }

  // El nombre de la opción NO se cambia: es el que ve el cliente, y puede ser
  // el de su carta impresa ("Pan de gambas") aunque en la carta digital se
  // llame de otra forma. Solo se le pone el número.
  async function enlazarOpcion(o, producto) {
    const { error } = await supabase.from('menu_opciones').update({ producto_id: producto.id }).eq('id', o.id);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarTodo();
  }

  // Todo lo que casa sin dudas, de una vez. Lo dudoso se queda propuesto para
  // que lo decida una persona: un número equivocado es otro plato en cocina.
  async function enlazarLosClaros() {
    let n = 0;
    for (const [id, s] of claros.opciones) {
      const { error } = await supabase.from('menu_opciones').update({ producto_id: s.producto.id }).eq('id', id);
      if (error) { avisar('Error: ' + error.message); return; }
      n++;
    }
    for (const m of claros.menus) {
      const filas = filasDePropuesta(m.id, propuestaDe(m));
      const { error } = await supabase.from('menu_platos').insert(filas);
      if (error) { avisar('Error: ' + error.message); return; }
      n += filas.filter(f => f.producto_id).length;
    }
    await cargarTodo();
    avisar('Enlazados ' + n + ' platos con la carta.');
  }

  // Cómo se le va a enseñar el grupo al cliente por WhatsApp.
  function diagnosticoGrupo(g) {
    const ops = opciones[g.id] || [];
    const subs = Array.from(new Set(ops.map(o => o.subgrupo).filter(Boolean)));
    if (ops.length === 0) return { tono: 'aviso', texto: 'Sin opciones: el bot no podrá ofrecer este grupo.' };
    if (ops.length <= MAX_FILAS_LISTA) {
      return { tono: 'ok', texto: ops.length + ' opciones, en una sola lista.' };
    }
    if (subs.length >= 2 && subs.length <= MAX_FILAS_LISTA) {
      return { tono: 'ok', texto: ops.length + ' opciones: se ofrecen en dos pasos, por ' + subs.join(', ') + '.' };
    }
    return {
      tono: 'aviso',
      texto: ops.length + ' opciones y no caben en una lista (máximo ' + MAX_FILAS_LISTA +
             '). Agrúpalas por subapartado o quita alguna.',
    };
  }

  // Primero el número exacto ("15", como piensa la cocina), luego lo que casa
  // por palabras aunque esté en plural ("arroces fritos"), y luego lo que
  // contiene el texto tal cual.
  const productosFiltrados = (() => {
    const { texto } = leerLinea(busqueda);
    const q = texto.trim().toLowerCase();
    if (!q) return [];
    const porNumero = productos.filter(p => String(p.numero || '').toLowerCase() === q);
    const porPalabras = mejorPlato(texto, productos)?.alternativas || [];
    const porTexto = productos.filter(p => (p.nombre || '').toLowerCase().includes(q));
    const vistos = new Set();
    return [...porNumero, ...porPalabras, ...porTexto]
      .filter(p => !vistos.has(p.id) && vistos.add(p.id))
      .slice(0, 8);
  })();

  // Opciones sin número que tienen un plato de la carta que les casa.
  const sugerencias = useMemo(() => {
    const s = {};
    Object.values(opciones).flat().forEach(o => {
      if (o.producto_id) return;
      const m = mejorPlato(o.nombre, productos);
      if (m) s[o.id] = m;
    });
    return s;
  }, [opciones, productos]);

  // Lo que se puede enlazar de golpe: opciones seguras y menús cerrados sin
  // platos cuya descripción casa entera sin dudas.
  const claros = useMemo(() => ({
    opciones: Object.entries(sugerencias).filter(([, s]) => s.seguro),
    menus: menus.filter(m => {
      if ((grupos[m.id] || []).length > 0 || (platos[m.id] || []).length > 0) return false;
      const prop = proponerPlatos(m.descripcion, productos);
      return prop.some(p => p.producto) && prop.every(p => !p.producto || p.seguro);
    }),
  }), [sugerencias, menus, grupos, platos, productos]);
  const cuantosClaros = claros.opciones.length + claros.menus.length;

  if (cargando) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Menús</h1>
              <p className="text-xs text-text-muted hidden sm:block">Precio cerrado con platos a elegir</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/pedidos" className="btn-ghost">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </a>
            <div className="h-6 w-px bg-border mx-1" />
            <MenuNav />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {mensaje && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {mensaje}
          </div>
        )}

        {cuantosClaros > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 p-3 rounded-lg bg-accent/10 border border-accent/20 text-sm">
            <p className="text-text flex-1 min-w-[12rem]">
              {claros.opciones.length > 0 && <>{claros.opciones.length} {claros.opciones.length === 1 ? 'plato' : 'platos'} de menú sin número casan con la carta. </>}
              {claros.menus.length > 0 && <>{claros.menus.length} {claros.menus.length === 1 ? 'menú cerrado' : 'menús cerrados'} se pueden montar solos a partir de su descripción.</>}
            </p>
            <button onClick={enlazarLosClaros} className="btn-primary text-xs">
              <Check className="w-3.5 h-3.5" /> Enlazar con la carta
            </button>
          </div>
        )}

        {menus.length === 0 && !editandoMenu && (
          <div className="card p-6 text-center">
            <ClipboardList className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text mb-1">Todavía no tienes menús</p>
            <p className="text-xs text-text-muted mb-4">
              Un menú es un precio cerrado con grupos de platos a elegir: primer plato, segundo, bebida…
            </p>
            <button onClick={nuevoMenu} className="btn-primary mx-auto">
              <Plus className="w-4 h-4" /> Crear el primero
            </button>
          </div>
        )}

        {/* Formulario de menú */}
        {editandoMenu && datosMenu && (
          <div className="card p-4 mb-4 border-accent/30">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="text-xs text-text-muted">Nombre</label>
                <input
                  className="input w-full" value={datosMenu.nombre}
                  placeholder="Menú del Día"
                  onChange={e => setDatosMenu({ ...datosMenu, nombre: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-text-muted">Descripción (opcional)</label>
                {/* Área de texto y no una línea: la de un menú cerrado es una
                    lista, y un input se comía los saltos al guardar. */}
                <textarea
                  rows={3}
                  className="input w-full" value={datosMenu.descripcion}
                  placeholder="Excepto festivos"
                  onChange={e => setDatosMenu({ ...datosMenu, descripcion: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">Precio (€)</label>
                <input
                  className="input w-full" inputMode="decimal" value={datosMenu.precio}
                  placeholder="12,95"
                  onChange={e => setDatosMenu({ ...datosMenu, precio: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-text-muted">Turno</label>
                <select
                  className="input w-full" value={datosMenu.turno}
                  onChange={e => setDatosMenu({ ...datosMenu, turno: e.target.value })}
                >
                  <option value="manana">Solo mediodía</option>
                  <option value="noche">Solo noche</option>
                  <option value="">A cualquier hora</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs text-text-muted">Días que se sirve</label>
                <div className="flex gap-1.5 mt-1">
                  {DIAS.map(d => {
                    const puesto = (datosMenu.dias_semana || []).includes(d.num);
                    return (
                      <button
                        key={d.num}
                        title={d.largo}
                        onClick={() => setDatosMenu({
                          ...datosMenu,
                          dias_semana: puesto
                            ? datosMenu.dias_semana.filter(x => x !== d.num)
                            : [...datosMenu.dias_semana, d.num].sort((a, b) => a - b),
                        })}
                        className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                          puesto
                            ? 'bg-accent/15 text-accent border-accent/30'
                            : 'bg-surface-2 text-text-muted border-border'
                        }`}
                      >
                        {d.corto}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={guardarMenu} className="btn-primary">
                <Check className="w-4 h-4" /> Guardar
              </button>
              <button onClick={() => { setEditandoMenu(null); setDatosMenu(null); }} className="btn-ghost">
                <X className="w-4 h-4" /> Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de menús */}
        <div className="space-y-3">
          {menus.map(m => {
            const abierto = abiertos[m.id];
            const gs = grupos[m.id] || [];
            return (
              <div key={m.id} className="card overflow-hidden">
                <div className="flex items-center gap-2 p-4">
                  <button
                    onClick={() => setAbiertos(p => ({ ...p, [m.id]: !p[m.id] }))}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    {abierto ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text truncate">
                        {m.nombre}
                        {!m.activo && <span className="ml-2 badge bg-surface-2 text-text-muted border border-border">Desactivado</span>}
                      </p>
                      <p className="text-xs text-text-muted">
                        {Number(m.precio).toFixed(2)} € ·{' '}
                        {gs.length > 0 ? gs.length + ' grupos' : (platos[m.id] || []).length + ' platos incluidos'} ·{' '}
                        {(m.dias_semana || []).map(n => DIAS.find(d => d.num === n)?.corto).join('')}
                        {m.turno === 'manana' ? ' mediodía' : m.turno === 'noche' ? ' noche' : ''}
                      </p>
                    </div>
                  </button>
                  <button onClick={() => alternarActivo(m)} className="btn-ghost p-2" title={m.activo ? 'Desactivar' : 'Activar'}>
                    {m.activo ? <Check className="w-4 h-4 text-accent" /> : <X className="w-4 h-4" />}
                  </button>
                  <button onClick={() => editarMenu(m)} className="btn-ghost p-2" title="Editar">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => borrarMenu(m)} className="btn-ghost p-2" title="Borrar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {abierto && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    {gs.length === 0 && (() => {
                      const pls = platos[m.id] || [];
                      const clave = 'incluye:' + m.id;
                      const sinNumero = pls.filter(p => !p.producto_id).length;
                      return (
                        <div className="rounded-lg border border-border p-3">
                          <p className="text-sm font-semibold text-text mb-1">Qué incluye</p>
                          <p className={`text-xs mb-2 ${pls.length > 0 ? 'text-text-muted' : 'text-amber-600 dark:text-amber-400'}`}>
                            {pls.length === 0
                              ? 'Menú cerrado sin platos enlazados: el ticket de cocina sacará solo la descripción, sin números.'
                              : 'Menú cerrado: cocina verá estos platos con su número' +
                                (sinNumero > 0 ? ' (' + sinNumero + ' sin número, no están en la carta).' : '.')}
                          </p>

                          {pls.length === 0 && (m.descripcion || '').trim() !== '' && (() => {
                            const prop = propuestaDe(m);
                            return (
                              <div className="mb-2 rounded-lg bg-surface-2 p-2">
                                <p className="text-xs text-text-muted mb-1.5">
                                  Propuesta sacada de la descripción. Revisa lo marcado y guarda.
                                </p>
                                <ul className="space-y-1">
                                  {prop.map((p, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm">
                                      <span className="tabular-nums text-text-muted w-8 shrink-0">{p.cantidad}×</span>
                                      <select
                                        className="input text-xs flex-1 min-w-0"
                                        value={p.producto ? p.producto.id : ''}
                                        onChange={e => cambiarPropuesta(m, i, e.target.value)}
                                      >
                                        <option value="">{p.texto} (sin número)</option>
                                        {p.alternativas.map(a => (
                                          <option key={a.id} value={a.id}>{a.numero ? a.numero + '. ' : ''}{a.nombre}</option>
                                        ))}
                                      </select>
                                      {p.producto && !p.seguro && (
                                        <span className="badge bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">revisar</span>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                                <button onClick={() => guardarPropuesta(m)} className="btn-primary text-xs mt-2">
                                  <Check className="w-3.5 h-3.5" /> Guardar estos platos
                                </button>
                              </div>
                            );
                          })()}

                          <ul className="space-y-1 mb-2">
                            {pls.map(p => (
                              <li key={p.id + ':' + p.cantidad} className="flex items-center gap-2 text-sm">
                                <input
                                  className="input w-14 text-xs shrink-0 tabular-nums"
                                  inputMode="numeric"
                                  defaultValue={p.cantidad}
                                  title="Cantidad"
                                  onBlur={e => cambiarCantidad(p, e.target.value)}
                                />
                                {numeroDeProducto(p.producto_id) && (
                                  <span className="text-xs text-text-muted tabular-nums shrink-0">{numeroDeProducto(p.producto_id)}</span>
                                )}
                                <span className="text-text truncate">{p.nombre}</span>
                                {!p.producto_id && (
                                  <span className="badge bg-surface-2 text-text-muted border border-border shrink-0" title="No está enlazado a la carta: sale en el ticket sin número">
                                    sin número
                                  </span>
                                )}
                                <button onClick={() => borrarPlato(p)} className="btn-ghost p-1.5 ml-auto shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>

                          {anadiendoEn === clave ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <input
                                  className="input flex-1" autoFocus
                                  placeholder="2 rollos de primavera, o el número…"
                                  value={busqueda}
                                  onChange={e => setBusqueda(e.target.value)}
                                  onKeyDown={e => {
                                    // Intro añade el plato si casa sin dudas.
                                    if (e.key !== 'Enter') return;
                                    const { cantidad, texto } = leerLinea(busqueda);
                                    const porNumero = productos.find(p => String(p.numero || '').toLowerCase() === texto.trim().toLowerCase());
                                    const mejor = porNumero ? { producto: porNumero, seguro: true } : mejorPlato(texto, productos);
                                    if (mejor && mejor.seguro) anadirPlato(m.id, mejor.producto, cantidad);
                                  }}
                                />
                                <button onClick={() => { setAnadiendoEn(null); setBusqueda(''); }} className="btn-ghost p-2">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {(() => {
                                const { cantidad, texto } = leerLinea(busqueda);
                                const porNumero = productos.find(p => String(p.numero || '').toLowerCase() === texto.trim().toLowerCase());
                                const mejor = porNumero ? { producto: porNumero, seguro: true } : mejorPlato(texto, productos);
                                if (!mejor || !mejor.seguro) return null;
                                return (
                                  <p className="text-xs text-text-muted">
                                    Intro para añadir {cantidad}× {mejor.producto.numero ? mejor.producto.numero + '. ' : ''}{mejor.producto.nombre}
                                  </p>
                                );
                              })()}
                              {productosFiltrados.length > 0 && (
                                <ul className="rounded-lg border border-border divide-y divide-border">
                                  {productosFiltrados.map(p => (
                                    <li key={p.id}>
                                      <button
                                        onClick={() => anadirPlato(m.id, p, leerLinea(busqueda).cantidad)}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 flex items-center gap-2"
                                      >
                                        {p.numero && <span className="text-xs text-text-muted tabular-nums">{p.numero}</span>}
                                        <span className="text-text">{p.nombre}</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {busqueda.trim() !== '' && (
                                <button
                                  onClick={() => anadirPlato(m.id, null, leerLinea(busqueda).cantidad)}
                                  className="w-full text-left px-3 py-2 rounded-lg border border-dashed border-border hover:border-accent/40 text-sm"
                                >
                                  <span className="text-text">
                                    Añadir <strong>&ldquo;{leerLinea(busqueda).texto}&rdquo;</strong> sin número
                                  </span>
                                  <span className="block text-xs text-text-muted mt-0.5">
                                    Para lo que no está en la carta: bebida, postre…
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <button onClick={() => { setAnadiendoEn(clave); setBusqueda(''); setSubgrupoNuevo(''); }} className="btn-ghost text-xs">
                              <Plus className="w-3.5 h-3.5" /> Añadir plato
                            </button>
                          )}
                        </div>
                      );
                    })()}
                    {gs.map(g => {
                      const ops = opciones[g.id] || [];
                      const diag = diagnosticoGrupo(g);
                      return (
                        <div key={g.id} className="rounded-lg border border-border p-3">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <p className="text-sm font-semibold text-text">{g.nombre}</p>
                            <button onClick={() => borrarGrupo(g)} className="btn-ghost p-1.5" title="Borrar grupo">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className={`text-xs mb-2 ${diag.tono === 'ok' ? 'text-text-muted' : 'text-amber-600 dark:text-amber-400'}`}>
                            {diag.texto}
                          </p>

                          <ul className="space-y-1 mb-2">
                            {ops.map(o => (
                              <li key={o.id} className="flex items-center gap-2 text-sm">
                                {o.subgrupo && (
                                  <span className="badge bg-surface-2 text-text-muted border border-border shrink-0">
                                    {o.subgrupo}
                                  </span>
                                )}
                                {numeroDeProducto(o.producto_id) && (
                                  <span className="text-xs text-text-muted tabular-nums shrink-0">{numeroDeProducto(o.producto_id)}</span>
                                )}
                                <span className="text-text truncate">{o.nombre}</span>
                                {!o.producto_id && (
                                  <span className="badge bg-surface-2 text-text-muted border border-border shrink-0" title="No está en la carta: solo existe dentro del menú">
                                    solo menú
                                  </span>
                                )}
                                {!o.producto_id && sugerencias[o.id] && (
                                  <button
                                    onClick={() => enlazarOpcion(o, sugerencias[o.id].producto)}
                                    className={`badge border shrink-0 max-w-[16rem] truncate ${
                                      sugerencias[o.id].seguro
                                        ? 'bg-accent/10 text-accent border-accent/30'
                                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                    }`}
                                    title="Ponerle el número de este plato de la carta"
                                  >
                                    {sugerencias[o.id].seguro ? 'Enlazar con el ' : '¿Es el '}
                                    {sugerencias[o.id].producto.numero ? sugerencias[o.id].producto.numero + '. ' : ''}
                                    {sugerencias[o.id].producto.nombre}{sugerencias[o.id].seguro ? '' : '?'}
                                  </button>
                                )}
                                <input
                                  className="input w-20 ml-auto text-xs shrink-0"
                                  defaultValue={Number(o.suplemento) === 0 ? '' : Number(o.suplemento).toFixed(2)}
                                  placeholder="+0,00"
                                  title="Suplemento"
                                  onBlur={e => {
                                    if (e.target.value !== String(o.suplemento)) cambiarSuplemento(o, e.target.value);
                                  }}
                                />
                                <button onClick={() => borrarOpcion(o)} className="btn-ghost p-1.5 shrink-0">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>

                          {anadiendoEn === g.id ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <input
                                  className="input flex-1" autoFocus
                                  placeholder="Buscar plato de la carta…"
                                  value={busqueda}
                                  onChange={e => setBusqueda(e.target.value)}
                                />
                                <input
                                  className="input w-32"
                                  placeholder="Subapartado"
                                  title="Opcional: Pollo, Ternera, Sopa…"
                                  value={subgrupoNuevo}
                                  onChange={e => setSubgrupoNuevo(e.target.value)}
                                />
                                <button onClick={() => { setAnadiendoEn(null); setBusqueda(''); setSubgrupoNuevo(''); }} className="btn-ghost p-2">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              {productosFiltrados.length > 0 && (
                                <ul className="rounded-lg border border-border divide-y divide-border">
                                  {productosFiltrados.map(p => (
                                    <li key={p.id}>
                                      <button
                                        onClick={() => anadirOpcion(g.id, p)}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-surface-2 flex items-center gap-2"
                                      >
                                        {p.numero && <span className="text-xs text-text-muted tabular-nums">{p.numero}</span>}
                                        <span className="text-text">{p.nombre}</span>
                                        <span className="ml-auto text-xs text-text-muted">{Number(p.precio).toFixed(2)} €</span>
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {busqueda.trim() !== '' && (
                                <button
                                  onClick={() => anadirOpcionLibre(g.id)}
                                  className="w-full text-left px-3 py-2 rounded-lg border border-dashed border-border hover:border-accent/40 text-sm"
                                >
                                  <span className="text-text">
                                    Añadir <strong>&ldquo;{busqueda.trim()}&rdquo;</strong> como plato solo del menú
                                  </span>
                                  <span className="block text-xs text-text-muted mt-0.5">
                                    Para lo que no se vende suelto (postres, café…). Sin número de plato.
                                  </span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <button onClick={() => { setAnadiendoEn(g.id); setBusqueda(''); setSubgrupoNuevo(''); }} className="btn-ghost text-xs">
                              <Plus className="w-3.5 h-3.5" /> Añadir plato
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {nuevoGrupoEn === m.id ? (
                      <div className="flex gap-2">
                        <input
                          className="input flex-1" autoFocus
                          placeholder="Primer plato"
                          value={nombreGrupo}
                          onChange={e => setNombreGrupo(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') crearGrupo(m.id); }}
                        />
                        <button onClick={() => crearGrupo(m.id)} className="btn-primary">
                          <Check className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setNuevoGrupoEn(null); setNombreGrupo(''); }} className="btn-ghost p-2">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setNuevoGrupoEn(m.id)} className="btn-ghost text-sm">
                        <Plus className="w-4 h-4" /> Añadir grupo
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {menus.length > 0 && !editandoMenu && (
          <button onClick={nuevoMenu} className="btn-ghost mt-4">
            <Plus className="w-4 h-4" /> Nuevo menú
          </button>
        )}
      </main>
    </div>
  );
}

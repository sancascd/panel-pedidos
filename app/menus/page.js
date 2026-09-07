'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import MenuNav from '@/components/MenuNav';
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

    const porMenu = {}; const porGrupo = {};
    (gs || []).forEach(g => { (porMenu[g.menu_id] = porMenu[g.menu_id] || []).push(g); });
    (os || []).forEach(o => { (porGrupo[o.grupo_id] = porGrupo[o.grupo_id] || []).push(o); });
    setMenus(ms || []);
    setGrupos(porMenu);
    setOpciones(porGrupo);
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

  const productosFiltrados = busqueda.trim() === ''
    ? []
    : productos.filter(p => (p.nombre || '').toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 8);

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
                <input
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
                        {Number(m.precio).toFixed(2)} € · {gs.length} grupos ·{' '}
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
                                <span className="text-text truncate">{o.nombre}</span>
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
                              {busqueda.trim() !== '' && productosFiltrados.length === 0 && (
                                <p className="text-xs text-text-muted px-1">
                                  Ningún plato de la carta se llama así. Los platos del menú se eligen de la carta,
                                  para que el ticket salga con su número.
                                </p>
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

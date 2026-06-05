'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import MenuNav from '@/components/MenuNav';
import {
  ArrowLeft, Plus, Pencil, Trash2, Check, X, GripVertical,
  UtensilsCrossed, Loader2, AlertCircle, ChevronDown, ChevronRight
} from 'lucide-react';

export default function PaginaCarta() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [restauranteId, setRestauranteId] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [productosPorCategoria, setProductosPorCategoria] = useState({});
  const [mensaje, setMensaje] = useState('');

  // Estados de edicion de categoria
  const [editandoCatId, setEditandoCatId] = useState(null);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [nombreCatEdicion, setNombreCatEdicion] = useState('');

  // Estados de edicion de producto
  const [editandoProdId, setEditandoProdId] = useState(null);
  const [agregandoProductoEnCat, setAgregandoProductoEnCat] = useState(null);
  const [datosProd, setDatosProd] = useState({ nombre: '', precio: '', descripcion: '', disponible: true });

  const [categoriasAbiertas, setCategoriasAbiertas] = useState({});

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) {
        avisar('No tienes restaurante asignado.');
        setCargando(false);
        return;
      }
      setRestauranteId(restId);
      await cargarCategorias(restId);
      setCargando(false);
    }
    init();
  }, []);

  function avisar(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 4000);
  }

  async function cargarCategorias(restId) {
    const { data } = await supabase
      .from('categorias').select('*')
      .eq('restaurante_id', restId).order('orden');
    setCategorias(data || []);
    // Por defecto todas abiertas
    const abiertas = {};
    (data || []).forEach(c => { abiertas[c.id] = true; });
    setCategoriasAbiertas(abiertas);
    // Cargar productos de cada categoria
    for (const cat of (data || [])) {
      await cargarProductos(cat.id);
    }
  }

  async function cargarProductos(catId) {
    const { data } = await supabase
      .from('productos').select('*')
      .eq('categoria_id', catId).order('nombre');
    setProductosPorCategoria(prev => ({ ...prev, [catId]: data || [] }));
  }

  async function crearCategoria() {
    if (!nuevaCategoria.trim()) return;
    const orden = categorias.length + 1;
    const { error } = await supabase
      .from('categorias')
      .insert({ restaurante_id: restauranteId, nombre: nuevaCategoria.trim(), orden });
    if (error) { avisar('Error: ' + error.message); return; }
    setNuevaCategoria('');
    await cargarCategorias(restauranteId);
  }

  async function guardarCategoria(catId) {
    if (!nombreCatEdicion.trim()) return;
    const { error } = await supabase
      .from('categorias').update({ nombre: nombreCatEdicion.trim() }).eq('id', catId);
    if (error) { avisar('Error: ' + error.message); return; }
    setEditandoCatId(null);
    setNombreCatEdicion('');
    await cargarCategorias(restauranteId);
  }

  async function borrarCategoria(catId) {
    if (!confirm('¿Borrar esta categoría con todos sus productos?')) return;
    await supabase.from('productos').delete().eq('categoria_id', catId);
    const { error } = await supabase.from('categorias').delete().eq('id', catId);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarCategorias(restauranteId);
  }

  async function crearProducto(catId) {
    if (!datosProd.nombre.trim() || !datosProd.precio) return;
    const { error } = await supabase
      .from('productos').insert({
        restaurante_id: restauranteId,
        categoria_id: catId,
        nombre: datosProd.nombre.trim(),
        precio: parseFloat(datosProd.precio),
        descripcion: datosProd.descripcion.trim() || null,
        disponible: datosProd.disponible
      });
    if (error) { avisar('Error: ' + error.message); return; }
    setAgregandoProductoEnCat(null);
    setDatosProd({ nombre: '', precio: '', descripcion: '', disponible: true });
    await cargarProductos(catId);
  }

  async function guardarProducto(prodId, catId) {
    if (!datosProd.nombre.trim() || !datosProd.precio) return;
    const { error } = await supabase
      .from('productos').update({
        nombre: datosProd.nombre.trim(),
        precio: parseFloat(datosProd.precio),
        descripcion: datosProd.descripcion.trim() || null,
        disponible: datosProd.disponible
      }).eq('id', prodId);
    if (error) { avisar('Error: ' + error.message); return; }
    setEditandoProdId(null);
    setDatosProd({ nombre: '', precio: '', descripcion: '', disponible: true });
    await cargarProductos(catId);
  }

  async function borrarProducto(prodId, catId) {
    if (!confirm('¿Borrar este producto?')) return;
    const { error } = await supabase.from('productos').delete().eq('id', prodId);
    if (error) { avisar('Error: ' + error.message); return; }
    await cargarProductos(catId);
  }

  async function toggleDisponible(prod) {
    await supabase.from('productos')
      .update({ disponible: !prod.disponible })
      .eq('id', prod.id);
    await cargarProductos(prod.categoria_id);
  }

  function empezarEditarProducto(prod) {
    setEditandoProdId(prod.id);
    setDatosProd({
      nombre: prod.nombre,
      precio: String(prod.precio),
      descripcion: prod.descripcion || '',
      disponible: prod.disponible
    });
  }

  function toggleCategoria(catId) {
    setCategoriasAbiertas(prev => ({ ...prev, [catId]: !prev[catId] }));
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <UtensilsCrossed className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Mi carta</h1>
              <p className="text-xs text-text-muted hidden sm:block">Categorías y productos</p>
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
          <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-sm animate-fade-in">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{mensaje}</span>
          </div>
        )}

        {/* Crear nueva categoria */}
        <div className="card p-4 mb-6">
          <label className="label">Crear nueva categoría</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && crearCategoria()}
              className="input"
              placeholder="Ej: Pizzas, Bebidas, Postres..."
            />
            <button onClick={crearCategoria} disabled={!nuevaCategoria.trim()} className="btn-primary">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Crear</span>
            </button>
          </div>
        </div>

        {/* Lista de categorias */}
        {categorias.length === 0 ? (
          <div className="card p-12 text-center">
            <UtensilsCrossed className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
            <p className="text-text-muted">Aún no tienes categorías. Crea la primera arriba.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {categorias.map(cat => (
              <div key={cat.id} className="card overflow-hidden">
                <div className="flex items-center gap-2 p-4">
                  <button
                    onClick={() => toggleCategoria(cat.id)}
                    className="btn-ghost p-1"
                  >
                    {categoriasAbiertas[cat.id] ?
                      <ChevronDown className="w-4 h-4" /> :
                      <ChevronRight className="w-4 h-4" />
                    }
                  </button>

                  {editandoCatId === cat.id ? (
                    <>
                      <input
                        type="text"
                        value={nombreCatEdicion}
                        onChange={(e) => setNombreCatEdicion(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && guardarCategoria(cat.id)}
                        className="input flex-1"
                        autoFocus
                      />
                      <button onClick={() => guardarCategoria(cat.id)} className="btn-primary p-2">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditandoCatId(null)} className="btn-ghost p-2">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <h2 className="flex-1 text-base font-semibold text-text">{cat.nombre}</h2>
                      <span className="text-xs text-text-muted">
                        {(productosPorCategoria[cat.id] || []).length} productos
                      </span>
                      <button
                        onClick={() => { setEditandoCatId(cat.id); setNombreCatEdicion(cat.nombre); }}
                        className="btn-ghost p-2"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => borrarCategoria(cat.id)} className="btn-ghost p-2 hover:text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>

                {categoriasAbiertas[cat.id] && (
                  <div className="border-t border-border bg-surface-2/30">
                    {/* Lista de productos */}
                    {(productosPorCategoria[cat.id] || []).map(prod => (
                      <div key={prod.id} className="border-b border-border last:border-b-0 p-4">
                        {editandoProdId === prod.id ? (
                          <div className="space-y-3">
                            <input
                              type="text"
                              value={datosProd.nombre}
                              onChange={(e) => setDatosProd({ ...datosProd, nombre: e.target.value })}
                              className="input"
                              placeholder="Nombre del producto"
                            />
                            <div className="flex gap-2">
                              <input
                                type="number"
                                step="0.01"
                                value={datosProd.precio}
                                onChange={(e) => setDatosProd({ ...datosProd, precio: e.target.value })}
                                className="input flex-1"
                                placeholder="Precio"
                              />
                              <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface border border-border cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={datosProd.disponible}
                                  onChange={(e) => setDatosProd({ ...datosProd, disponible: e.target.checked })}
                                  className="accent-accent"
                                />
                                <span className="text-sm">Disponible</span>
                              </label>
                            </div>
                            <textarea
                              value={datosProd.descripcion}
                              onChange={(e) => setDatosProd({ ...datosProd, descripcion: e.target.value })}
                              className="input"
                              rows="2"
                              placeholder="Descripción (opcional)"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => guardarProducto(prod.id, cat.id)} className="btn-primary flex-1">
                                <Check className="w-4 h-4" />
                                Guardar
                              </button>
                              <button onClick={() => setEditandoProdId(null)} className="btn-secondary">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <h3 className={`font-medium text-text ${!prod.disponible ? 'line-through opacity-50' : ''}`}>
                                  {prod.nombre}
                                </h3>
                                <span className="text-sm font-semibold text-accent tabular-nums">
                                  {Number(prod.precio).toFixed(2)}€
                                </span>
                                {!prod.disponible && (
                                  <span className="badge bg-surface-2 text-text-muted border border-border">
                                    No disponible
                                  </span>
                                )}
                              </div>
                              {prod.descripcion && (
                                <p className="text-sm text-text-muted mt-1">{prod.descripcion}</p>
                              )}
                            </div>
                            <button
                              onClick={() => toggleDisponible(prod)}
                              className="btn-ghost p-2"
                              title={prod.disponible ? 'Desactivar' : 'Activar'}
                            >
                              {prod.disponible ?
                                <Check className="w-4 h-4 text-accent" /> :
                                <X className="w-4 h-4 text-text-muted" />
                              }
                            </button>
                            <button onClick={() => empezarEditarProducto(prod)} className="btn-ghost p-2">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button onClick={() => borrarProducto(prod.id, cat.id)} className="btn-ghost p-2 hover:text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Agregar nuevo producto */}
                    {agregandoProductoEnCat === cat.id ? (
                      <div className="p-4 bg-surface space-y-3">
                        <input
                          type="text"
                          value={datosProd.nombre}
                          onChange={(e) => setDatosProd({ ...datosProd, nombre: e.target.value })}
                          className="input"
                          placeholder="Nombre del producto"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={datosProd.precio}
                            onChange={(e) => setDatosProd({ ...datosProd, precio: e.target.value })}
                            className="input flex-1"
                            placeholder="Precio"
                          />
                          <label className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-2 border border-border cursor-pointer">
                            <input
                              type="checkbox"
                              checked={datosProd.disponible}
                              onChange={(e) => setDatosProd({ ...datosProd, disponible: e.target.checked })}
                              className="accent-accent"
                            />
                            <span className="text-sm">Disponible</span>
                          </label>
                        </div>
                        <textarea
                          value={datosProd.descripcion}
                          onChange={(e) => setDatosProd({ ...datosProd, descripcion: e.target.value })}
                          className="input"
                          rows="2"
                          placeholder="Descripción (opcional)"
                        />
                        <div className="flex gap-2">
                          <button onClick={() => crearProducto(cat.id)} className="btn-primary flex-1">
                            <Plus className="w-4 h-4" />
                            Crear producto
                          </button>
                          <button
                            onClick={() => { setAgregandoProductoEnCat(null); setDatosProd({ nombre: '', precio: '', descripcion: '', disponible: true }); }}
                            className="btn-secondary"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setAgregandoProductoEnCat(cat.id)}
                        className="w-full p-4 text-sm font-medium text-text-muted hover:text-accent hover:bg-accent/5 transition-colors flex items-center justify-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Añadir producto
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

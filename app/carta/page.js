'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';

export default function PaginaCarta() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [restauranteId, setRestauranteId] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [productos, setProductos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState('');

  // Formulario de categoría nueva
  const [nuevaCategoria, setNuevaCategoria] = useState('');

  // Formulario de producto nuevo (uno por categoría, guardamos cuál está abierto)
  const [prodForm, setProdForm] = useState({}); // { [categoriaId]: {nombre, descripcion, precio} }

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      // Obtener el restaurante del usuario
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) {
        setMensaje('No tienes ningún restaurante asignado.');
        setCargando(false);
        return;
      }
      setRestauranteId(restId);
      await cargarCarta(restId);
      setCargando(false);
    }
    init();
  }, []);

  async function cargarCarta(restId) {
    const { data: cats } = await supabase
      .from('categorias')
      .select('*')
      .eq('restaurante_id', restId)
      .order('orden', { ascending: true });

    const { data: prods } = await supabase
      .from('productos')
      .select('*')
      .eq('restaurante_id', restId)
      .order('nombre', { ascending: true });

    setCategorias(cats || []);
    setProductos(prods || []);
  }

  function avisar(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 3000);
  }

  // ---------- CATEGORÍAS ----------

  async function crearCategoria(e) {
    e.preventDefault();
    if (!nuevaCategoria.trim()) return;

    const { error } = await supabase.from('categorias').insert({
      restaurante_id: restauranteId,
      nombre: nuevaCategoria.trim(),
      orden: categorias.length,
    });

    if (error) {
      avisar('Error al crear la categoría: ' + error.message);
      return;
    }
    setNuevaCategoria('');
    avisar('Categoría creada');
    await cargarCarta(restauranteId);
  }

  async function borrarCategoria(cat) {
    const productosEnCat = productos.filter(p => p.categoria_id === cat.id);
    const aviso = productosEnCat.length > 0
      ? `"${cat.nombre}" tiene ${productosEnCat.length} producto(s). Si la borras, se borrarán también. ¿Continuar?`
      : `¿Borrar la categoría "${cat.nombre}"?`;
    if (!confirm(aviso)) return;

    // Borrar primero los productos de esa categoría
    if (productosEnCat.length > 0) {
      await supabase.from('productos').delete().eq('categoria_id', cat.id);
    }
    const { error } = await supabase.from('categorias').delete().eq('id', cat.id);

    if (error) {
      avisar('Error al borrar: ' + error.message);
      return;
    }
    avisar('Categoría borrada');
    await cargarCarta(restauranteId);
  }

  async function renombrarCategoria(cat) {
    const nuevoNombre = prompt('Nuevo nombre para la categoría:', cat.nombre);
    if (!nuevoNombre || !nuevoNombre.trim()) return;

    const { error } = await supabase
      .from('categorias')
      .update({ nombre: nuevoNombre.trim() })
      .eq('id', cat.id);

    if (error) {
      avisar('Error al renombrar: ' + error.message);
      return;
    }
    avisar('Categoría renombrada');
    await cargarCarta(restauranteId);
  }

  // ---------- PRODUCTOS ----------

  function actualizarProdForm(catId, campo, valor) {
    setProdForm(prev => ({
      ...prev,
      [catId]: { ...(prev[catId] || {}), [campo]: valor },
    }));
  }

  async function crearProducto(e, catId) {
    e.preventDefault();
    const form = prodForm[catId] || {};
    const nombre = (form.nombre || '').trim();
    const descripcion = (form.descripcion || '').trim();
    const precio = parseFloat(form.precio);

    if (!nombre) {
      avisar('El producto necesita un nombre');
      return;
    }
    if (isNaN(precio) || precio < 0) {
      avisar('Pon un precio válido');
      return;
    }

    const { error } = await supabase.from('productos').insert({
      restaurante_id: restauranteId,
      categoria_id: catId,
      nombre: nombre,
      descripcion: descripcion || null,
      precio: precio,
      disponible: true,
    });

    if (error) {
      avisar('Error al crear el producto: ' + error.message);
      return;
    }
    // Limpiar el formulario de esa categoría
    setProdForm(prev => ({ ...prev, [catId]: { nombre: '', descripcion: '', precio: '' } }));
    avisar('Producto añadido');
    await cargarCarta(restauranteId);
  }

  async function borrarProducto(prod) {
    if (!confirm(`¿Borrar el producto "${prod.nombre}"?`)) return;
    const { error } = await supabase.from('productos').delete().eq('id', prod.id);
    if (error) {
      avisar('Error al borrar: ' + error.message);
      return;
    }
    avisar('Producto borrado');
    await cargarCarta(restauranteId);
  }

  async function toggleDisponible(prod) {
    const { error } = await supabase
      .from('productos')
      .update({ disponible: !prod.disponible })
      .eq('id', prod.id);
    if (error) {
      avisar('Error: ' + error.message);
      return;
    }
    await cargarCarta(restauranteId);
  }

  async function editarProducto(prod) {
    const nuevoNombre = prompt('Nombre del producto:', prod.nombre);
    if (nuevoNombre === null) return;
    const nuevaDesc = prompt('Descripción (puede quedar vacía):', prod.descripcion || '');
    if (nuevaDesc === null) return;
    const nuevoPrecioStr = prompt('Precio:', prod.precio);
    if (nuevoPrecioStr === null) return;

    const nuevoPrecio = parseFloat(nuevoPrecioStr);
    if (isNaN(nuevoPrecio) || nuevoPrecio < 0) {
      avisar('Precio no válido');
      return;
    }

    const { error } = await supabase
      .from('productos')
      .update({
        nombre: nuevoNombre.trim(),
        descripcion: nuevaDesc.trim() || null,
        precio: nuevoPrecio,
      })
      .eq('id', prod.id);

    if (error) {
      avisar('Error al editar: ' + error.message);
      return;
    }
    avisar('Producto actualizado');
    await cargarCarta(restauranteId);
  }

  // ---------- RENDER ----------

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Cabecera */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">🍕 Gestión de la Carta</h1>
          <a href="/pedidos" className="text-sm text-blue-600 hover:underline">
            ← Volver a pedidos
          </a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">

        {mensaje && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-4">{mensaje}</div>
        )}

        {/* Crear categoría nueva */}
        <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
          <h2 className="font-semibold mb-3">Añadir una categoría</h2>
          <form onSubmit={crearCategoria} className="flex gap-2">
            <input
              type="text"
              value={nuevaCategoria}
              onChange={(e) => setNuevaCategoria(e.target.value)}
              placeholder="Ej: Pizzas, Bebidas, Postres..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2 rounded-lg"
            >
              Añadir
            </button>
          </form>
        </div>

        {/* Lista de categorías con sus productos */}
        {categorias.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">
            Aún no tienes categorías. Crea la primera arriba (por ejemplo "Pizzas").
          </div>
        ) : (
          <div className="space-y-6">
            {categorias.map(cat => {
              const prodsCat = productos.filter(p => p.categoria_id === cat.id);
              const form = prodForm[cat.id] || { nombre: '', descripcion: '', precio: '' };
              return (
                <div key={cat.id} className="bg-white rounded-lg shadow-sm p-5">
                  {/* Cabecera de la categoría */}
                  <div className="flex justify-between items-center mb-4 pb-3 border-b">
                    <h3 className="text-lg font-bold">{cat.nombre}</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => renombrarCategoria(cat)}
                        className="text-sm text-gray-600 hover:text-blue-600"
                      >
                        Renombrar
                      </button>
                      <button
                        onClick={() => borrarCategoria(cat)}
                        className="text-sm text-gray-600 hover:text-red-600"
                      >
                        Borrar
                      </button>
                    </div>
                  </div>

                  {/* Productos de la categoría */}
                  {prodsCat.length === 0 ? (
                    <p className="text-sm text-gray-400 mb-4">
                      Sin productos en esta categoría todavía.
                    </p>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {prodsCat.map(prod => (
                        <div
                          key={prod.id}
                          className={`flex justify-between items-start p-3 rounded-lg border ${
                            prod.disponible ? 'border-gray-200' : 'border-gray-200 bg-gray-50 opacity-60'
                          }`}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{prod.nombre}</span>
                              {!prod.disponible && (
                                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                                  Agotado
                                </span>
                              )}
                            </div>
                            {prod.descripcion && (
                              <p className="text-sm text-gray-500">{prod.descripcion}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <span className="font-semibold text-gray-900">
                              {Number(prod.precio).toFixed(2)}€
                            </span>
                            <button
                              onClick={() => toggleDisponible(prod)}
                              className="text-xs text-gray-600 hover:text-blue-600"
                              title={prod.disponible ? 'Marcar como agotado' : 'Marcar como disponible'}
                            >
                              {prod.disponible ? '🟢' : '⚪'}
                            </button>
                            <button
                              onClick={() => editarProducto(prod)}
                              className="text-sm text-gray-600 hover:text-blue-600"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => borrarProducto(prod)}
                              className="text-sm text-gray-600 hover:text-red-600"
                            >
                              Borrar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulario para añadir producto a esta categoría */}
                  <form
                    onSubmit={(e) => crearProducto(e, cat.id)}
                    className="bg-gray-50 rounded-lg p-3 grid grid-cols-1 md:grid-cols-12 gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={(e) => actualizarProdForm(cat.id, 'nombre', e.target.value)}
                      placeholder="Nombre del producto"
                      className="md:col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      value={form.descripcion}
                      onChange={(e) => actualizarProdForm(cat.id, 'descripcion', e.target.value)}
                      placeholder="Descripción (ej: tomate, mozzarella, albahaca)"
                      className="md:col-span-6 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.precio}
                      onChange={(e) => actualizarProdForm(cat.id, 'precio', e.target.value)}
                      placeholder="Precio"
                      className="md:col-span-2 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      className="md:col-span-1 bg-blue-600 hover:bg-blue-700 text-white font-medium px-3 py-2 rounded-lg text-sm"
                    >
                      +
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

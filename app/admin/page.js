'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';

const ESTADO_COLORES = {
  pendiente: 'bg-yellow-100 text-yellow-800',
  activo: 'bg-green-100 text-green-800',
  suspendido: 'bg-red-100 text-red-800',
};

export default function PaginaAdmin() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [esAdmin, setEsAdmin] = useState(null); // null = comprobando
  const [restaurantes, setRestaurantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState('pendiente');
  const [mensaje, setMensaje] = useState('');

  // Comprobar sesión + permisos al cargar
  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      // Comprobar si es superadmin
      const { data: admin } = await supabase.rpc('soy_superadmin');
      if (!admin) {
        setEsAdmin(false);
        setCargando(false);
        return;
      }

      setEsAdmin(true);
      await cargarRestaurantes();
      setCargando(false);
    }
    init();
  }, []);

  async function cargarRestaurantes() {
    const { data, error } = await supabase.rpc('listar_restaurantes_admin');
    if (error) {
      console.error(error);
      return;
    }
    setRestaurantes(data || []);
  }

  async function aprobar(id, nombre) {
    if (!confirm(`¿Aprobar "${nombre}"?`)) return;
    const { error } = await supabase.rpc('aprobar_restaurante', { restaurante_id_in: id });
    if (error) {
      setMensaje('Error: ' + error.message);
      return;
    }
    setMensaje(`✅ "${nombre}" aprobado`);
    setTimeout(() => setMensaje(''), 3000);
    await cargarRestaurantes();
  }

  async function rechazar(id, nombre) {
    if (!confirm(`¿Suspender "${nombre}"? No podrá recibir pedidos.`)) return;
    const { error } = await supabase.rpc('rechazar_restaurante', { restaurante_id_in: id });
    if (error) {
      setMensaje('Error: ' + error.message);
      return;
    }
    setMensaje(`❌ "${nombre}" suspendido`);
    setTimeout(() => setMensaje(''), 3000);
    await cargarRestaurantes();
  }

  function formatearFecha(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  // Filtrar según pestaña activa
  const filtrados = restaurantes.filter(r => {
    if (filtro === 'todos') return true;
    return r.estado === filtro;
  });

  const contadores = {
    pendiente: restaurantes.filter(r => r.estado === 'pendiente').length,
    activo: restaurantes.filter(r => r.estado === 'activo').length,
    suspendido: restaurantes.filter(r => r.estado === 'suspendido').length,
  };

  // Pantallas según estado
  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (esAdmin === false) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso denegado</h1>
          <p className="text-gray-600 mb-6">No tienes permisos para acceder a esta sección.</p>
          <Link href="/pedidos" className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg">
            Volver a pedidos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Cabecera */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">🛡️ Panel de Administración</h1>
          <Link href="/pedidos" className="text-sm text-blue-600 hover:underline">
            ← Volver al panel de pedidos
          </Link>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        <h2 className="text-2xl font-bold mb-4">Restaurantes registrados</h2>

        {mensaje && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-4">{mensaje}</div>
        )}

        {/* Pestañas */}
        <div className="flex gap-2 mb-6 border-b">
          {[
            { key: 'pendiente', label: 'Pendientes', count: contadores.pendiente },
            { key: 'activo', label: 'Activos', count: contadores.activo },
            { key: 'suspendido', label: 'Suspendidos', count: contadores.suspendido },
            { key: 'todos', label: 'Todos', count: restaurantes.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFiltro(tab.key)}
              className={`px-4 py-2 font-medium text-sm transition border-b-2 ${
                filtro === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Lista */}
        {filtrados.length === 0 ? (
          <div className="bg-white p-8 rounded-lg text-center text-gray-500">
            No hay restaurantes en esta categoría.
          </div>
        ) : (
          <div className="space-y-3">
            {filtrados.map(r => (
              <div key={r.id} className="bg-white rounded-lg shadow-sm p-5">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-lg font-bold">{r.nombre}</h3>
                    <p className="text-sm text-gray-500">Registrado el {formatearFecha(r.creado_en)}</p>
                  </div>
                  <span className={`text-xs px-3 py-1 rounded-full font-medium ${ESTADO_COLORES[r.estado]}`}>
                    {r.estado.toUpperCase()}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-gray-500">Email</p>
                    <p className="font-medium">{r.email_contacto || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Teléfono</p>
                    <p className="font-medium">{r.telefono || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Dirección</p>
                    <p className="font-medium">{r.direccion || '-'}</p>
                  </div>
                </div>

                {/* Botones según estado */}
                <div className="flex gap-2">
                  {r.estado === 'pendiente' && (
                    <>
                      <button
                        onClick={() => aprobar(r.id, r.nombre)}
                        className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                      >
                        ✅ Aprobar
                      </button>
                      <button
                        onClick={() => rechazar(r.id, r.nombre)}
                        className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                      >
                        ❌ Rechazar
                      </button>
                    </>
                  )}
                  {r.estado === 'activo' && (
                    <button
                      onClick={() => rechazar(r.id, r.nombre)}
                      className="bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium px-4 py-2 rounded-lg"
                    >
                      Suspender
                    </button>
                  )}
                  {r.estado === 'suspendido' && (
                    <button
                      onClick={() => aprobar(r.id, r.nombre)}
                      className="bg-green-100 hover:bg-green-200 text-green-700 text-sm font-medium px-4 py-2 rounded-lg"
                    >
                      Reactivar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

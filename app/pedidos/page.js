'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';

export default function PaginaLogin() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Si ya hay sesión activa, redirigimos directamente a /pedidos
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.push('/pedidos');
    });
  }, []);

  async function manejarLogin(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    setCargando(false);

    if (error) {
      setError('Email o contraseña incorrectos.');
      return;
    }

    router.push('/pedidos');
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Panel de Pedidos
        </h1>
        <p className="text-gray-500 mb-8">
          Inicia sesión para ver tus pedidos
        </p>

        <form onSubmit={manejarLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-2.5 rounded-lg transition"
          >
            {cargando ? 'Iniciando sesión...' : 'Entrar'}
          </button>
        </form>

        {/* Enlace al registro */}
        <div className="mt-6 pt-6 border-t text-center">
          <p className="text-sm text-gray-600 mb-2">
            ¿Aún no tienes cuenta?
          </p>
          <Link
            href="/registro"
            className="inline-block text-blue-600 hover:text-blue-700 font-medium text-sm"
          >
            Registra tu restaurante →
          </Link>
        </div>
      </div>
    </div>
  );
}

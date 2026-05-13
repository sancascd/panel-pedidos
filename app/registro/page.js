'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';

export default function PaginaRegistro() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  // Datos del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nombreRest, setNombreRest] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');

  // Estado de la página
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState(false);

  async function manejarRegistro(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setCargando(true);

    // 1. Crear el usuario en Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (authError) {
      setCargando(false);
      if (authError.message.includes('already')) {
        setError('Ya existe una cuenta con ese email. Inicia sesión en su lugar.');
      } else {
        setError('No se pudo crear la cuenta: ' + authError.message);
      }
      return;
    }

    // 2. Iniciar sesión (por si no se inicia automáticamente)
    if (!authData.session) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });
      if (loginError) {
        setCargando(false);
        setError('Cuenta creada, pero no se pudo iniciar sesión: ' + loginError.message);
        return;
      }
    }

    // 3. Llamar a la función de Supabase que crea el restaurante y lo vincula
    const { error: rpcError } = await supabase.rpc('registrar_restaurante', {
      nombre_in: nombreRest,
      telefono_in: telefono,
      direccion_in: direccion,
      email_in: email,
    });

    setCargando(false);

    if (rpcError) {
      setError('Cuenta creada pero hubo un problema registrando el restaurante: ' + rpcError.message);
      return;
    }

    // 4. Éxito
    setExito(true);
  }

  // Pantalla de éxito (cuando ya se ha registrado)
  if (exito) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            ¡Solicitud recibida!
          </h1>
          <p className="text-gray-600 mb-6">
            Hemos recibido tu solicitud para registrar <strong>{nombreRest}</strong>.
            Revisaremos tus datos y te avisaremos por email en cuanto tu cuenta esté activa.
          </p>
          <Link
            href="/"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition"
          >
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  // Formulario de registro
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Registra tu restaurante
        </h1>
        <p className="text-gray-500 mb-6 text-sm">
          Crea tu cuenta y empieza a recibir pedidos por WhatsApp.
        </p>

        <form onSubmit={manejarRegistro} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre del restaurante
            </label>
            <input
              type="text"
              required
              value={nombreRest}
              onChange={(e) => setNombreRest(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Pizzería La Mejor"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teléfono del restaurante
            </label>
            <input
              type="tel"
              required
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="+34 600 00 00 00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Dirección
            </label>
            <input
              type="text"
              required
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Calle Mayor 5, Madrid"
            />
          </div>

          <div className="border-t pt-4 mt-2">
            <p className="text-xs text-gray-500 mb-3">
              Datos para acceder al panel:
            </p>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Mínimo 6 caracteres"
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
            {cargando ? 'Creando cuenta...' : 'Registrar restaurante'}
          </button>

          <div className="text-center text-sm text-gray-500 pt-2">
            ¿Ya tienes cuenta?{' '}
            <Link href="/" className="text-blue-600 hover:underline">
              Inicia sesión
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

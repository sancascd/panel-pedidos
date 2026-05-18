'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  MessageSquare, Loader2, ArrowRight, ArrowLeft,
  AlertCircle, CheckCircle2, Mail, Lock, Store
} from 'lucide-react';

export default function PaginaRegistro() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [error, setError] = useState('');

  const [datos, setDatos] = useState({
    email: '',
    password: '',
    nombreRestaurante: '',
  });

  async function registrar(e) {
    e.preventDefault();
    setCargando(true);
    setError('');

    try {
      // Crear cuenta
      const { data: signUpData, error: errSignUp } = await supabase.auth.signUp({
        email: datos.email,
        password: datos.password,
      });
      if (errSignUp) throw errSignUp;
      if (!signUpData.user) throw new Error('No se pudo crear el usuario.');

      // Confirmar email automáticamente
      await supabase.rpc('confirmar_email_usuario', { p_email: datos.email });

      // Iniciar sesión
      const { error: errLogin } = await supabase.auth.signInWithPassword({
        email: datos.email,
        password: datos.password,
      });
      if (errLogin) throw errLogin;

      // Registrar restaurante
      const { error: errReg } = await supabase.rpc('registrar_restaurante', {
        p_nombre: datos.nombreRestaurante.trim(),
      });
      if (errReg) throw errReg;

      setCompletado(true);
    } catch (e) {
      setError(e.message || 'Error al registrarse.');
    }
    setCargando(false);
  }

  if (completado) {
    return (
      <div className="min-h-screen flex flex-col bg-bg">
        <div className="fixed inset-0 -z-10 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
        </div>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md animate-slide-up">
            <div className="card p-8 text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-accent/10 mb-4">
                <CheckCircle2 className="w-7 h-7 text-accent" strokeWidth={2.5} />
              </div>
              <h1 className="text-2xl font-bold text-text mb-2">¡Cuenta creada!</h1>
              <p className="text-text-muted mb-6">
                Tu solicitud está siendo revisada. En cuanto se apruebe podrás empezar a usar Comandi.
                Te avisaremos por email.
              </p>
              <Link href="/" className="btn-primary w-full">
                Volver al inicio
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-slide-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 mb-4">
              <MessageSquare className="w-6 h-6 text-accent" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Crear cuenta en Comandi
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Empieza a recibir pedidos por WhatsApp
            </p>
          </div>

          <div className="card p-6">
            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={registrar} className="space-y-4">
              <div>
                <label className="label">Nombre de tu restaurante</label>
                <div className="relative">
                  <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    required
                    value={datos.nombreRestaurante}
                    onChange={(e) => setDatos({ ...datos, nombreRestaurante: e.target.value })}
                    className="input pl-9"
                    placeholder="Pizzería Bella Napoli"
                  />
                </div>
              </div>

              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="email"
                    required
                    value={datos.email}
                    onChange={(e) => setDatos({ ...datos, email: e.target.value })}
                    className="input pl-9"
                    placeholder="tu@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="label">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="password"
                    required
                    minLength="6"
                    value={datos.password}
                    onChange={(e) => setDatos({ ...datos, password: e.target.value })}
                    className="input pl-9"
                    placeholder="Al menos 6 caracteres"
                  />
                </div>
              </div>

              <button type="submit" disabled={cargando} className="btn-primary w-full">
                {cargando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando cuenta...
                  </>
                ) : (
                  <>
                    Crear cuenta
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-border text-center text-sm">
              <span className="text-text-muted">¿Ya tienes cuenta? </span>
              <Link
                href="/"
                className="font-medium text-accent hover:text-accent-hover transition-colors"
              >
                Inicia sesión
              </Link>
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-text-muted">
            Tu cuenta será revisada antes de activarse.
          </p>
        </div>
      </main>
    </div>
  );
}

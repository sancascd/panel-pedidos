'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';
import { MessageSquare, Loader2, ArrowRight, AlertCircle } from 'lucide-react';

export default function PaginaLogin() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  async function iniciarSesion(e) {
    e.preventDefault();
    setCargando(true);
    setError('');

    // Confirmar email automaticamente (por si no se confirmo)
    try {
      await supabase.rpc('confirmar_email_usuario', { p_email: email });
    } catch (e) {}

    const { error: errLogin } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setCargando(false);
    if (errLogin) {
      setError('Email o contraseña incorrectos.');
      return;
    }
    router.push('/pedidos');
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* Fondo decorativo sutil */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-slide-up">
          {/* Logo */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 mb-4">
              <MessageSquare className="w-6 h-6 text-accent" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text">
              Comandi
            </h1>
            <p className="text-sm text-text-muted mt-1">
              Recibe pedidos por WhatsApp
            </p>
          </div>

          {/* Tarjeta de login */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-text mb-1">Inicia sesión</h2>
            <p className="text-sm text-text-muted mb-6">
              Accede al panel de tu restaurante
            </p>

            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={iniciarSesion} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="tu@email.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="label">Contraseña</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={cargando}
                className="btn-primary w-full"
              >
                {cargando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-border text-center text-sm">
              <span className="text-text-muted">¿Aún no tienes cuenta? </span>
              <Link
                href="/registro"
                className="font-medium text-accent hover:text-accent-hover transition-colors"
              >
                Regístrate
              </Link>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-text-muted">
            Hecho con cuidado para restaurantes españoles
          </p>
        </div>
      </main>
    </div>
  );
}

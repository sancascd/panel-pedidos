'use client';

import { useState } from 'react';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';
import { MessageSquare, Loader2, ArrowLeft, AlertCircle, CheckCircle2, Mail } from 'lucide-react';

export default function PaginaRecuperarContrasena() {
  const supabase = crearClienteSupabase();

  const [email, setEmail] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [enviado, setEnviado] = useState(false);

  async function pedirReset(e) {
    e.preventDefault();
    setCargando(true);
    setError('');

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}/cambiar-contrasena`
        : 'https://comandi.es/cambiar-contrasena';

    const { error: errReset } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

    setCargando(false);
    if (errReset) {
      // No revelamos si el email existe o no (evita enumerar usuarios)
      console.log('resetPasswordForEmail error:', errReset.message);
    }
    // Siempre mostramos "enviado" aunque el email no exista (mejor UX y seguridad)
    setEnviado(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm animate-slide-up">
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-accent/10 mb-4">
              <MessageSquare className="w-6 h-6 text-accent" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-text">Comandi</h1>
            <p className="text-sm text-text-muted mt-1">Recibe pedidos por WhatsApp</p>
          </div>

          <div className="card p-6">
            {enviado ? (
              <div className="text-center py-2 animate-fade-in">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-accent" strokeWidth={2.5} />
                </div>
                <h2 className="text-lg font-semibold text-text mb-2">Mira tu email</h2>
                <p className="text-sm text-text-muted mb-6">
                  Si <strong className="text-text">{email}</strong> está registrado,
                  te hemos enviado un enlace para cambiar tu contraseña.
                </p>
                <p className="text-xs text-text-muted">
                  El enlace caduca en 1 hora. Revisa también la carpeta de spam.
                </p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-text mb-1">¿Olvidaste tu contraseña?</h2>
                <p className="text-sm text-text-muted mb-6">
                  Escribe tu email y te mandamos un enlace para recuperarla.
                </p>

                {error && (
                  <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={pedirReset} className="space-y-4">
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

                  <button type="submit" disabled={cargando} className="btn-primary w-full">
                    {cargando ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4" />
                        Enviar enlace
                      </>
                    )}
                  </button>
                </form>
              </>
            )}

            <div className="mt-6 pt-6 border-t border-border text-center text-sm">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Volver al inicio de sesión
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

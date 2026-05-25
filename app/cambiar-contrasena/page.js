'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';
import { MessageSquare, Loader2, AlertCircle, CheckCircle2, Lock } from 'lucide-react';

export default function PaginaCambiarContrasena() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [completado, setCompletado] = useState(false);
  const [sesionValida, setSesionValida] = useState(null); // null = comprobando

  // Cuando el usuario llega aqui desde el email, Supabase ya ha creado una sesion
  // temporal. Si no la hay, el link es invalido o caduco.
  useEffect(() => {
    async function chequear() {
      const { data: { session } } = await supabase.auth.getSession();
      setSesionValida(!!session);
    }
    chequear();
  }, []);

  async function cambiarContrasena(e) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setCargando(true);
    const { error: errUpdate } = await supabase.auth.updateUser({ password });
    setCargando(false);

    if (errUpdate) {
      setError('No se pudo cambiar la contraseña: ' + errUpdate.message);
      return;
    }
    setCompletado(true);
    setTimeout(() => router.push('/pedidos'), 2000);
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
          </div>

          <div className="card p-6">
            {sesionValida === null ? (
              <div className="py-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-text-muted mx-auto" />
              </div>
            ) : !sesionValida ? (
              <div className="text-center py-2">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 mb-4">
                  <AlertCircle className="w-6 h-6 text-red-500" strokeWidth={2.5} />
                </div>
                <h2 className="text-lg font-semibold text-text mb-2">Enlace no válido</h2>
                <p className="text-sm text-text-muted mb-6">
                  El enlace ha caducado o no es válido. Pide uno nuevo.
                </p>
                <Link href="/recuperar-contrasena" className="btn-primary w-full">
                  Pedir nuevo enlace
                </Link>
              </div>
            ) : completado ? (
              <div className="text-center py-2 animate-fade-in">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-4">
                  <CheckCircle2 className="w-6 h-6 text-accent" strokeWidth={2.5} />
                </div>
                <h2 className="text-lg font-semibold text-text mb-2">Contraseña actualizada</h2>
                <p className="text-sm text-text-muted">Redirigiendo al panel...</p>
              </div>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-text mb-1">Nueva contraseña</h2>
                <p className="text-sm text-text-muted mb-6">
                  Elige una contraseña que no uses en otros sitios.
                </p>

                {error && (
                  <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <form onSubmit={cambiarContrasena} className="space-y-4">
                  <div>
                    <label className="label">Contraseña nueva</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input"
                      placeholder="Mínimo 8 caracteres"
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label className="label">Repite la contraseña</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password2}
                      onChange={(e) => setPassword2(e.target.value)}
                      className="input"
                      placeholder="Igual que arriba"
                      autoComplete="new-password"
                    />
                  </div>

                  <button type="submit" disabled={cargando} className="btn-primary w-full">
                    {cargando ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Guardando...
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        Cambiar contraseña
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

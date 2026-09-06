'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  MessageSquare, Loader2, ArrowRight, ArrowLeft,
  AlertCircle, CheckCircle2, Mail, Lock, Store, Briefcase, User
} from 'lucide-react';

export default function PaginaRegistro() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(false);
  const [completado, setCompletado] = useState(false);
  const [error, setError] = useState('');

  // Una cuenta es de un restaurante O de un comercial, nunca las dos cosas:
  // mi_restaurante_id() y mi_comercial_id() se pisarian.
  const [tipo, setTipo] = useState(null); // 'restaurante' | 'comercial'

  const [datos, setDatos] = useState({
    email: '',
    password: '',
    nombreRestaurante: '',
    nombreComercial: '',
    telefono: '',
  });

  async function registrar(e) {
    e.preventDefault();
    setCargando(true);
    setError('');

    try {
      // 1. Crear la cuenta
      const { data: signUpData, error: errSignUp } = await supabase.auth.signUp({
        email: datos.email.trim(),
        password: datos.password,
      });
      if (errSignUp) throw errSignUp;
      if (!signUpData.user) throw new Error('No se pudo crear la cuenta. Prueba con otro correo.');

      // 2. Confirmar el email.
      // OJO: esto se llama SIN sesion (todavia no hemos entrado), y
      // supabase.rpc() NO lanza excepciones: devuelve { error }. Antes esto
      // estaba dentro de un try/catch vacio, asi que si fallaba nos
      // quedabamos con la cuenta creada pero sin confirmar, el login de
      // abajo reventaba y el usuario veia un error incomprensible. Si falla,
      // seguimos: puede que el proyecto no exija confirmacion.
      const { error: errConfirmar } = await supabase
        .rpc('confirmar_email_usuario', { p_email: datos.email.trim() });
      if (errConfirmar) console.log('No se pudo confirmar el email:', errConfirmar.message);

      // 3. Iniciar sesion. Si signUp ya devolvio sesion, no hace falta.
      if (!signUpData.session) {
        const { error: errLogin } = await supabase.auth.signInWithPassword({
          email: datos.email.trim(),
          password: datos.password,
        });
        if (errLogin) {
          // El caso tipico: el email no ha quedado confirmado.
          if (/confirm/i.test(errLogin.message)) {
            throw new Error(
              'Tu cuenta se ha creado, pero falta confirmar el correo y no hemos podido hacerlo automaticamente. ' +
              'Escribenos a info@comandi.es y te activamos el acceso en un momento.'
            );
          }
          throw errLogin;
        }
      }

      if (tipo === 'comercial') {
        const { error: errCom } = await supabase.rpc('solicitar_alta_comercial', {
          p_nombre: datos.nombreComercial.trim(),
          p_telefono: datos.telefono.trim() || null,
        });
        if (errCom) throw errCom;
      } else {
        const { error: errReg } = await supabase.rpc('registrar_restaurante', {
          p_nombre: datos.nombreRestaurante.trim(),
        });
        if (errReg) throw errReg;
      }

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
                {tipo === 'comercial'
                  ? 'Revisaremos tu solicitud y te avisaremos por email. En cuanto la aprobemos podrás entrar a tu panel y empezar a registrar restaurantes.'
                  : 'Tu solicitud está siendo revisada. En cuanto se apruebe podrás empezar a usar Comandi. Te avisaremos por email.'}
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

  // Primero, quien eres. Una cuenta es de un restaurante O de un comercial,
  // nunca las dos cosas.
  if (!tipo) {
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
              <h1 className="text-2xl font-bold tracking-tight text-text">Crear cuenta en Comandi</h1>
              <p className="text-sm text-text-muted mt-1">¿Qué quieres hacer?</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setTipo('restaurante')}
                className="card p-5 w-full text-left hover:border-accent/40 transition-colors flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Store className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-text">Tengo un restaurante</p>
                  <p className="text-sm text-text-muted mt-0.5">
                    Quiero recibir mis pedidos por WhatsApp.
                  </p>
                </div>
              </button>

              <button
                onClick={() => setTipo('comercial')}
                className="card p-5 w-full text-left hover:border-accent/40 transition-colors flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-5 h-5 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-text">Quiero ser comercial</p>
                  <p className="text-sm text-text-muted mt-0.5">
                    Quiero presentar Comandi a restaurantes y cobrar por cada alta.
                  </p>
                </div>
              </button>
            </div>

            <p className="text-center text-sm text-text-muted mt-6">
              ¿Ya tienes cuenta?{' '}
              <Link href="/login" className="text-accent hover:underline font-medium">Inicia sesión</Link>
            </p>
            <p className="text-center text-xs text-text-muted mt-3">
              <Link href="/comerciales" className="hover:text-accent">
                Ver en qué consiste ser comercial
              </Link>
            </p>
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
              {tipo === 'comercial' ? 'Solicitar ser comercial' : 'Crear cuenta en Comandi'}
            </h1>
            <p className="text-sm text-text-muted mt-1">
              {tipo === 'comercial'
                ? 'Revisamos tu solicitud y te damos acceso'
                : 'Empieza a recibir pedidos por WhatsApp'}
            </p>
            <button
              onClick={() => { setTipo(null); setError(''); }}
              className="text-xs text-text-muted hover:text-text transition-colors mt-3 inline-flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" />
              No es lo que buscaba
            </button>
          </div>

          <div className="card p-6">
            {error && (
              <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={registrar} className="space-y-4">
              {tipo === 'comercial' ? (
                <>
                  <div>
                    <label className="label">Tu nombre y apellidos</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="text"
                        required
                        value={datos.nombreComercial}
                        onChange={(e) => setDatos({ ...datos, nombreComercial: e.target.value })}
                        className="input pl-9"
                        placeholder="María García"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="label">Teléfono</label>
                    <input
                      type="tel"
                      value={datos.telefono}
                      onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
                      className="input"
                      placeholder="600 00 00 00"
                    />
                  </div>
                </>
              ) : (
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
              )}

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

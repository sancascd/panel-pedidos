'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  ArrowLeft, Shield, Loader2, AlertCircle, CheckCircle2,
  Clock, Check, X, Store, Mail, Phone, MapPin, User
} from 'lucide-react';

export default function PaginaAdmin() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [esAdmin, setEsAdmin] = useState(false);
  const [restaurantes, setRestaurantes] = useState([]);
  const [pestana, setPestana] = useState('pendientes');
  const [procesando, setProcesando] = useState(null);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: 'success' });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: admin } = await supabase.rpc('soy_superadmin');
      if (admin !== true) {
        router.push('/pedidos');
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
    if (error) { console.log('Error:', error); return; }
    setRestaurantes(data || []);
  }

  function avisar(texto, tipo = 'success') {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: 'success' }), 5000);
  }

  async function aprobar(restId) {
    setProcesando(restId);
    const { error } = await supabase.rpc('aprobar_restaurante', { p_restaurante_id: restId });
    setProcesando(null);
    if (error) { avisar('Error: ' + error.message, 'error'); return; }
    avisar('Restaurante aprobado.');
    await cargarRestaurantes();
  }

  async function rechazar(restId) {
    if (!confirm('¿Rechazar este restaurante? La cuenta no podrá iniciar sesión.')) return;
    setProcesando(restId);
    const { error } = await supabase.rpc('rechazar_restaurante', { p_restaurante_id: restId });
    setProcesando(null);
    if (error) { avisar('Error: ' + error.message, 'error'); return; }
    avisar('Restaurante rechazado.');
    await cargarRestaurantes();
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  const pendientes = restaurantes.filter(r => r.estado === 'pendiente');
  const aprobados = restaurantes.filter(r => r.estado === 'aprobado');
  const rechazados = restaurantes.filter(r => r.estado === 'rechazado');

  function listaActual() {
    if (pestana === 'pendientes') return pendientes;
    if (pestana === 'aprobados') return aprobados;
    return rechazados;
  }

  function badgeEstado(estado) {
    if (estado === 'pendiente') {
      return (
        <span className="badge bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20">
          <Clock className="w-3 h-3" /> Pendiente
        </span>
      );
    }
    if (estado === 'aprobado') {
      return (
        <span className="badge bg-accent/10 text-accent border border-accent/20">
          <Check className="w-3 h-3" /> Aprobado
        </span>
      );
    }
    return (
      <span className="badge bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
        <X className="w-3 h-3" /> Rechazado
      </span>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Panel de administración</h1>
              <p className="text-xs text-text-muted hidden sm:block">Gestión de restaurantes</p>
            </div>
          </div>
          <a href="/pedidos" className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </a>
        </div>
      </header>

      {/* Pestañas */}
      <div className="border-b border-border bg-bg">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1">
          {[
            { id: 'pendientes', label: 'Pendientes', count: pendientes.length, icon: Clock },
            { id: 'aprobados', label: 'Aprobados', count: aprobados.length, icon: Check },
            { id: 'rechazados', label: 'Rechazados', count: rechazados.length, icon: X },
          ].map(t => {
            const Icono = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setPestana(t.id)}
                className={`inline-flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition-colors ${
                  pestana === t.id
                    ? 'border-accent text-text'
                    : 'border-transparent text-text-muted hover:text-text'
                }`}
              >
                <Icono className="w-4 h-4" />
                {t.label}
                <span className="tabular-nums text-xs px-1.5 py-0.5 rounded-md bg-surface-2 text-text-muted">
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {mensaje.texto && (
          <div className={`mb-4 flex items-start gap-2 p-3 rounded-lg border text-sm animate-fade-in ${
            mensaje.tipo === 'error'
              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
              : 'bg-accent/10 border-accent/20 text-accent'
          }`}>
            {mensaje.tipo === 'error' ?
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> :
              <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
            }
            <span>{mensaje.texto}</span>
          </div>
        )}

        {listaActual().length === 0 ? (
          <div className="card p-12 text-center">
            <Store className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-50" />
            <p className="text-text-muted">
              No hay restaurantes {pestana === 'pendientes' ? 'pendientes' : pestana === 'aprobados' ? 'aprobados' : 'rechazados'}.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {listaActual().map(r => (
              <div key={r.id} className="card p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="text-base font-semibold text-text">{r.nombre || 'Sin nombre'}</h3>
                      {badgeEstado(r.estado)}
                    </div>
                    {r.descripcion && (
                      <p className="text-sm text-text-muted mb-3">{r.descripcion}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {r.email_contacto && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <Mail className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{r.email_contacto}</span>
                    </div>
                  )}
                  {r.telefono && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <span>{r.telefono}</span>
                    </div>
                  )}
                  {r.direccion && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{r.direccion}</span>
                    </div>
                  )}
                  {r.email_usuario && (
                    <div className="flex items-center gap-2 text-text-muted">
                      <User className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{r.email_usuario}</span>
                    </div>
                  )}
                </div>

                {r.estado === 'pendiente' && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-border">
                    <button
                      onClick={() => aprobar(r.id)}
                      disabled={procesando === r.id}
                      className="btn-primary flex-1"
                    >
                      {procesando === r.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Aprobar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => rechazar(r.id)}
                      disabled={procesando === r.id}
                      className="btn-danger flex-1"
                    >
                      <X className="w-4 h-4" />
                      Rechazar
                    </button>
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

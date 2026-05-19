'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  ArrowLeft, Settings, Loader2, AlertCircle, CheckCircle2,
  Upload, Trash2, FileText, Image as ImageIcon, ExternalLink, Star
} from 'lucide-react';

export default function PaginaAjustes() {
  const router = useRouter();
  const supabase = crearClienteSupabase();

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [subiendoPdf, setSubiendoPdf] = useState(false);
  const [restaurante, setRestaurante] = useState(null);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: 'success' });

  const [datos, setDatos] = useState({
    nombre: '',
    descripcion: '',
    telefono: '',
    direccion: '',
    email_contacto: '',
    carta_url: '',
    resenas_activas: true,
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) { setCargando(false); return; }
      const { data: rest } = await supabase
        .from('restaurantes').select('*').eq('id', restId).maybeSingle();
      if (rest) {
        setRestaurante(rest);
        setDatos({
          nombre: rest.nombre || '',
          descripcion: rest.descripcion || '',
          telefono: rest.telefono || '',
          direccion: rest.direccion || '',
          email_contacto: rest.email_contacto || '',
          carta_url: rest.carta_url || '',
          resenas_activas: rest.resenas_activas !== false,
        });
      }
      setCargando(false);
    }
    init();
  }, []);

  function avisar(texto, tipo = 'success') {
    setMensaje({ texto, tipo });
    setTimeout(() => setMensaje({ texto: '', tipo: 'success' }), 5000);
  }

  async function guardar() {
    setGuardando(true);
    const { error } = await supabase
      .from('restaurantes')
      .update({
        nombre: datos.nombre.trim() || null,
        descripcion: datos.descripcion.trim() || null,
        telefono: datos.telefono.trim() || null,
        direccion: datos.direccion.trim() || null,
        email_contacto: datos.email_contacto.trim() || null,
        carta_url: datos.carta_url.trim() || null,
        resenas_activas: datos.resenas_activas,
      })
      .eq('id', restaurante.id);
    setGuardando(false);
    if (error) { avisar('Error al guardar: ' + error.message, 'error'); return; }
    avisar('Cambios guardados correctamente.');
  }

  async function subirLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoLogo(true);
    const ext = file.name.split('.').pop();
    const path = `${restaurante.id}/logo.${ext}`;
    const { error: errUp } = await supabase.storage
      .from('logos').upload(path, file, { upsert: true });
    if (errUp) {
      setSubiendoLogo(false);
      avisar('Error subiendo logo: ' + errUp.message, 'error');
      return;
    }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    const url = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('restaurantes').update({ logo_url: url }).eq('id', restaurante.id);
    setRestaurante({ ...restaurante, logo_url: url });
    setSubiendoLogo(false);
    avisar('Logo actualizado.');
  }

  async function borrarLogo() {
    if (!confirm('¿Borrar el logo?')) return;
    await supabase.from('restaurantes').update({ logo_url: null }).eq('id', restaurante.id);
    setRestaurante({ ...restaurante, logo_url: null });
    avisar('Logo eliminado.');
  }

  async function subirPdf(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendoPdf(true);
    const path = `${restaurante.id}/carta.pdf`;
    const { error: errUp } = await supabase.storage
      .from('cartas').upload(path, file, { upsert: true });
    if (errUp) {
      setSubiendoPdf(false);
      avisar('Error subiendo PDF: ' + errUp.message, 'error');
      return;
    }
    const { data: urlData } = supabase.storage.from('cartas').getPublicUrl(path);
    const url = urlData.publicUrl + '?t=' + Date.now();
    await supabase.from('restaurantes').update({ carta_pdf_url: url }).eq('id', restaurante.id);
    setRestaurante({ ...restaurante, carta_pdf_url: url });
    setSubiendoPdf(false);
    avisar('PDF de la carta actualizado.');
  }

  async function borrarPdf() {
    if (!confirm('¿Borrar el PDF de la carta?')) return;
    await supabase.from('restaurantes').update({ carta_pdf_url: null }).eq('id', restaurante.id);
    setRestaurante({ ...restaurante, carta_pdf_url: null });
    avisar('PDF eliminado.');
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (!restaurante) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg p-6">
        <div className="card p-6 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text">No tienes restaurante asignado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Settings className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Ajustes</h1>
              <p className="text-xs text-text-muted hidden sm:block">Datos de tu restaurante</p>
            </div>
          </div>
          <a href="/pedidos" className="btn-ghost">
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Volver</span>
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {mensaje.texto && (
          <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm animate-fade-in ${
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

        {/* Datos básicos */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-text mb-4">Datos del restaurante</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Nombre del restaurante *</label>
              <input
                type="text"
                value={datos.nombre}
                onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
                className="input"
                placeholder="Ej: Pizzería Bella Napoli"
              />
            </div>
            <div>
              <label className="label">Descripción breve</label>
              <textarea
                value={datos.descripcion}
                onChange={(e) => setDatos({ ...datos, descripcion: e.target.value })}
                className="input"
                rows="2"
                placeholder="Ej: Auténtica pizza italiana hecha en horno de leña"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Teléfono</label>
                <input
                  type="tel"
                  value={datos.telefono}
                  onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
                  className="input"
                  placeholder="957 12 34 56"
                />
              </div>
              <div>
                <label className="label">Email de contacto</label>
                <input
                  type="email"
                  value={datos.email_contacto}
                  onChange={(e) => setDatos({ ...datos, email_contacto: e.target.value })}
                  className="input"
                  placeholder="hola@turestaurante.com"
                />
              </div>
            </div>
            <div>
              <label className="label">Dirección</label>
              <input
                type="text"
                value={datos.direccion}
                onChange={(e) => setDatos({ ...datos, direccion: e.target.value })}
                className="input"
                placeholder="Calle Mayor 5, Córdoba"
              />
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-text mb-4">Logo</h2>
          <p className="text-sm text-text-muted mb-4">
            Aparecerá arriba a la izquierda en el panel y en futuras comunicaciones.
          </p>
          <div className="flex items-center gap-4">
            {restaurante.logo_url ? (
              <img
                src={restaurante.logo_url}
                alt="Logo"
                className="w-20 h-20 rounded-xl object-cover bg-surface-2 border border-border"
              />
            ) : (
              <div className="w-20 h-20 rounded-xl bg-surface-2 border border-border flex items-center justify-center">
                <ImageIcon className="w-6 h-6 text-text-muted" />
              </div>
            )}
            <div className="flex gap-2">
              <label className="btn-primary cursor-pointer">
                {subiendoLogo ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {restaurante.logo_url ? 'Cambiar logo' : 'Subir logo'}
                  </>
                )}
                <input type="file" accept="image/*" onChange={subirLogo} className="hidden" />
              </label>
              {restaurante.logo_url && (
                <button onClick={borrarLogo} className="btn-ghost hover:text-red-500">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Carta */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-text mb-2">Carta para clientes</h2>
          <p className="text-sm text-text-muted mb-5">
            El bot enviará la carta al cliente cuando salude.
            Si tienes una <strong>URL web</strong> se manda eso. Si no, intenta el <strong>PDF</strong>.
            Si tampoco, manda la carta del panel como texto.
          </p>

          <div className="space-y-4">
            <div>
              <label className="label">URL de la carta web (opcional)</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={datos.carta_url}
                  onChange={(e) => setDatos({ ...datos, carta_url: e.target.value })}
                  className="input"
                  placeholder="https://miweb.com/carta"
                />
                {datos.carta_url && (
                  <a href={datos.carta_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
              </div>
            </div>

            <div>
              <label className="label">PDF de la carta (opcional)</label>
              <div className="flex items-center gap-3">
                {restaurante.carta_pdf_url ? (
                  <a
                    href={restaurante.carta_pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center gap-2 p-3 bg-surface-2 rounded-lg border border-border hover:border-accent/30 transition-colors"
                  >
                    <FileText className="w-5 h-5 text-accent" />
                    <span className="text-sm text-text">PDF subido</span>
                    <ExternalLink className="w-4 h-4 text-text-muted ml-auto" />
                  </a>
                ) : (
                  <div className="flex-1 flex items-center gap-2 p-3 bg-surface-2 rounded-lg border border-border">
                    <FileText className="w-5 h-5 text-text-muted" />
                    <span className="text-sm text-text-muted">Sin PDF</span>
                  </div>
                )}

                <label className="btn-secondary cursor-pointer">
                  {subiendoPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span className="hidden sm:inline">{restaurante.carta_pdf_url ? 'Cambiar' : 'Subir'}</span>
                    </>
                  )}
                  <input type="file" accept="application/pdf" onChange={subirPdf} className="hidden" />
                </label>
                {restaurante.carta_pdf_url && (
                  <button onClick={borrarPdf} className="btn-ghost hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reseñas automáticas */}
        <div className="card p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Star className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text">Reseñas automáticas</h2>
              <p className="text-sm text-text-muted mt-1">
                Cuando marques un pedido como entregado, el bot pedirá automáticamente al cliente
                una puntuación del 1 al 5 por WhatsApp. Verás todas las reseñas en su sección propia del panel.
              </p>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-surface-2 border border-border hover:border-accent/30 transition-colors">
            <input
              type="checkbox"
              checked={datos.resenas_activas}
              onChange={(e) => setDatos({ ...datos, resenas_activas: e.target.checked })}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-sm text-text">
              <strong className="font-medium">Activar reseñas automáticas</strong>
              {' '}<span className="text-text-muted">(se piden 30 min después de entregar a domicilio, o al instante si es recogida)</span>
            </span>
          </label>
        </div>

        <div className="sticky bottom-4">
          <button onClick={guardar} disabled={guardando} className="btn-primary w-full shadow-lift">
            {guardando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar cambios'
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

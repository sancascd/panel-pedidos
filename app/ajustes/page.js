'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';

export default function PaginaAjustes() {
  const router = useRouter();
  const supabase = crearClienteSupabase();
  const fileInputLogoRef = useRef(null);
  const fileInputPdfRef = useRef(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [subiendoPdf, setSubiendoPdf] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [restauranteId, setRestauranteId] = useState(null);

  const [datos, setDatos] = useState({
    nombre: '',
    descripcion: '',
    telefono: '',
    direccion: '',
    email_contacto: '',
    logo_url: '',
    carta_url: '',
    carta_pdf_url: ''
  });

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/'); return; }

      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) {
        setMensaje('No tienes ningún restaurante asignado.');
        setCargando(false);
        return;
      }
      setRestauranteId(restId);

      const { data: rest } = await supabase
        .from('restaurantes')
        .select('nombre, descripcion, telefono, direccion, email_contacto, logo_url, carta_url, carta_pdf_url')
        .eq('id', restId)
        .maybeSingle();

      if (rest) {
        setDatos({
          nombre: rest.nombre || '',
          descripcion: rest.descripcion || '',
          telefono: rest.telefono || '',
          direccion: rest.direccion || '',
          email_contacto: rest.email_contacto || '',
          logo_url: rest.logo_url || '',
          carta_url: rest.carta_url || '',
          carta_pdf_url: rest.carta_pdf_url || ''
        });
      }
      setCargando(false);
    }
    init();
  }, []);

  function actualizar(campo, valor) {
    setDatos(prev => ({ ...prev, [campo]: valor }));
  }

  function avisar(texto) {
    setMensaje(texto);
    setTimeout(() => setMensaje(''), 4000);
  }

  async function guardarDatos() {
    if (!datos.nombre.trim()) {
      avisar('El nombre del restaurante no puede estar vacío.');
      return;
    }
    setGuardando(true);
    const { error } = await supabase
      .from('restaurantes')
      .update({
        nombre: datos.nombre.trim(),
        descripcion: datos.descripcion.trim() || null,
        telefono: datos.telefono.trim() || null,
        direccion: datos.direccion.trim() || null,
        email_contacto: datos.email_contacto.trim() || null,
        carta_url: datos.carta_url.trim() || null
      })
      .eq('id', restauranteId);
    setGuardando(false);
    if (error) {
      avisar('Error al guardar: ' + error.message);
      return;
    }
    avisar('Datos guardados correctamente.');
  }

  async function subirLogo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      avisar('Solo se permiten imágenes.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      avisar('La imagen no puede pesar más de 2 MB.');
      return;
    }
    setSubiendoLogo(true);
    const ext = file.name.split('.').pop().toLowerCase();
    const nombreArchivo = restauranteId + '/logo-' + Date.now() + '.' + ext;
    const { error: errSubida } = await supabase.storage
      .from('logos')
      .upload(nombreArchivo, file, { upsert: true });
    if (errSubida) {
      setSubiendoLogo(false);
      avisar('Error al subir el logo: ' + errSubida.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(nombreArchivo);
    const urlPublica = urlData?.publicUrl;
    const { error: errUpdate } = await supabase
      .from('restaurantes')
      .update({ logo_url: urlPublica })
      .eq('id', restauranteId);
    setSubiendoLogo(false);
    if (errUpdate) {
      avisar('Logo subido, pero no se pudo guardar la URL: ' + errUpdate.message);
      return;
    }
    setDatos(prev => ({ ...prev, logo_url: urlPublica }));
    avisar('Logo actualizado correctamente.');
    if (fileInputLogoRef.current) fileInputLogoRef.current.value = '';
  }

  async function quitarLogo() {
    if (!confirm('¿Seguro que quieres quitar el logo?')) return;
    const { error } = await supabase
      .from('restaurantes')
      .update({ logo_url: null })
      .eq('id', restauranteId);
    if (error) {
      avisar('Error al quitar el logo: ' + error.message);
      return;
    }
    setDatos(prev => ({ ...prev, logo_url: '' }));
    avisar('Logo eliminado.');
  }

  async function subirPdf(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      avisar('Solo se permiten archivos PDF.');
      return;
    }
    // Limite 5 MB (Twilio admite hasta 16 MB pero mejor mantener algo razonable)
    if (file.size > 5 * 1024 * 1024) {
      avisar('El PDF no puede pesar más de 5 MB.');
      return;
    }
    setSubiendoPdf(true);
    const nombreArchivo = restauranteId + '/carta-' + Date.now() + '.pdf';
    const { error: errSubida } = await supabase.storage
      .from('cartas')
      .upload(nombreArchivo, file, { upsert: true, contentType: 'application/pdf' });
    if (errSubida) {
      setSubiendoPdf(false);
      avisar('Error al subir el PDF: ' + errSubida.message);
      return;
    }
    const { data: urlData } = supabase.storage.from('cartas').getPublicUrl(nombreArchivo);
    const urlPublica = urlData?.publicUrl;
    const { error: errUpdate } = await supabase
      .from('restaurantes')
      .update({ carta_pdf_url: urlPublica })
      .eq('id', restauranteId);
    setSubiendoPdf(false);
    if (errUpdate) {
      avisar('PDF subido, pero no se pudo guardar la URL: ' + errUpdate.message);
      return;
    }
    setDatos(prev => ({ ...prev, carta_pdf_url: urlPublica }));
    avisar('Carta PDF actualizada correctamente.');
    if (fileInputPdfRef.current) fileInputPdfRef.current.value = '';
  }

  async function quitarPdf() {
    if (!confirm('¿Seguro que quieres quitar el PDF de la carta?')) return;
    const { error } = await supabase
      .from('restaurantes')
      .update({ carta_pdf_url: null })
      .eq('id', restauranteId);
    if (error) {
      avisar('Error al quitar el PDF: ' + error.message);
      return;
    }
    setDatos(prev => ({ ...prev, carta_pdf_url: '' }));
    avisar('PDF eliminado.');
  }

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">⚙️ Ajustes del restaurante</h1>
          <a href="/pedidos" className="text-sm text-blue-600 hover:underline">
            ← Volver a pedidos
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">

        {mensaje && (
          <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-4">{mensaje}</div>
        )}

        {/* Logo */}
        <div className="bg-white rounded-lg shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-3">Logo</h2>
          <p className="text-sm text-gray-500 mb-4">
            Sube una imagen cuadrada (mínimo 200×200 px). Máximo 2 MB.
          </p>

          <div className="flex items-center gap-4 mb-3">
            {datos.logo_url ? (
              <img
                src={datos.logo_url}
                alt="Logo actual"
                className="w-24 h-24 rounded-lg object-cover bg-gray-100 border"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-gray-100 border border-dashed border-gray-300 flex items-center justify-center text-gray-400 text-xs text-center">
                Sin logo
              </div>
            )}

            <div className="flex flex-col gap-2">
              <input
                ref={fileInputLogoRef}
                type="file"
                accept="image/*"
                onChange={subirLogo}
                disabled={subiendoLogo}
                className="text-sm"
              />
              {datos.logo_url && (
                <button
                  onClick={quitarLogo}
                  className="text-sm text-red-600 hover:underline text-left"
                >
                  Quitar logo
                </button>
              )}
              {subiendoLogo && (
                <p className="text-sm text-gray-500">Subiendo...</p>
              )}
            </div>
          </div>
        </div>

        {/* Carta del restaurante */}
        <div className="bg-white rounded-lg shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-2">Carta para WhatsApp</h2>
          <p className="text-sm text-gray-500 mb-4">
            Cuando un cliente pida la carta, el bot intentará mandar primero la <strong>URL web</strong> si la tienes;
            si no, el <strong>PDF</strong>; y si no tienes nada, mostrará la lista de productos de la sección "🍕 Carta".
          </p>

          {/* URL de carta web */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              URL de tu carta en internet (opcional)
            </label>
            <input
              type="url"
              value={datos.carta_url}
              onChange={(e) => actualizar('carta_url', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="https://www.elrestaurante.com/carta"
            />
            <p className="text-xs text-gray-500 mt-1">
              Si tu web ya tiene la carta, pega aquí el enlace exacto. (No olvides guardar al final.)
            </p>
          </div>

          {/* PDF de la carta */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PDF de la carta (opcional)
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Si no tienes web pero tienes la carta en PDF, súbela aquí. Máximo 5 MB.
            </p>

            <div className="flex items-center gap-4">
              {datos.carta_pdf_url ? (
                <a
                  href={datos.carta_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded border border-red-200 hover:bg-red-100 text-sm"
                >
                  📄 Ver PDF actual
                </a>
              ) : (
                <p className="text-sm text-gray-400 italic">Aún no has subido ningún PDF</p>
              )}
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <input
                ref={fileInputPdfRef}
                type="file"
                accept="application/pdf"
                onChange={subirPdf}
                disabled={subiendoPdf}
                className="text-sm"
              />
              {datos.carta_pdf_url && (
                <button
                  onClick={quitarPdf}
                  className="text-sm text-red-600 hover:underline text-left"
                >
                  Quitar PDF
                </button>
              )}
              {subiendoPdf && (
                <p className="text-sm text-gray-500">Subiendo PDF...</p>
              )}
            </div>
          </div>
        </div>

        {/* Datos del restaurante */}
        <div className="bg-white rounded-lg shadow-sm p-5 mb-4">
          <h2 className="font-semibold text-gray-900 mb-4">Datos del restaurante</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nombre del restaurante *
              </label>
              <input
                type="text"
                value={datos.nombre}
                onChange={(e) => actualizar('nombre', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Ej: Pizzería La Marina"
              />
              <p className="text-xs text-gray-500 mt-1">
                Este nombre aparecerá en el saludo del bot ("Bienvenido a...") y en el panel.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Descripción (opcional)
              </label>
              <textarea
                value={datos.descripcion}
                onChange={(e) => actualizar('descripcion', e.target.value)}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Ej: La mejor pizza artesana de Córdoba"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Teléfono
              </label>
              <input
                type="text"
                value={datos.telefono}
                onChange={(e) => actualizar('telefono', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Ej: 957 123 456"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dirección
              </label>
              <input
                type="text"
                value={datos.direccion}
                onChange={(e) => actualizar('direccion', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Ej: Calle Mayor 5, Córdoba"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email de contacto
              </label>
              <input
                type="email"
                value={datos.email_contacto}
                onChange={(e) => actualizar('email_contacto', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded"
                placeholder="Ej: info@pizzeriamarina.com"
              />
            </div>
          </div>

          <button
            onClick={guardarDatos}
            disabled={guardando}
            className="mt-5 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-medium py-3 rounded-lg"
          >
            {guardando ? 'Guardando...' : 'Guardar datos'}
          </button>
        </div>

      </main>
    </div>
  );
}

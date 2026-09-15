'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import MenuNav from '@/components/MenuNav';
import { ArrowLeft, FileText, Loader2, AlertCircle, Download } from 'lucide-react';
import { euros, fechaCorta, periodoTexto, descargarPdf } from '@/lib/facturacion';

// Las facturas del restaurante. Solo ve las suyas: lo impone la base de
// datos (RLS de `facturas`), no esta página.
export default function PaginaFacturas() {
  const router = useRouter();
  const supabase = crearClienteSupabase();
  const [cargando, setCargando] = useState(true);
  const [facturas, setFacturas] = useState([]);
  const [error, setError] = useState('');
  const [descargando, setDescargando] = useState(null);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const { data: restId } = await supabase.rpc('mi_restaurante_id');
      if (!restId) { setCargando(false); return; }
      const { data, error: e } = await supabase
        .from('facturas')
        .select('id, numero, tipo, fecha_emision, periodo_inicio, periodo_fin, concepto, total, sustituida')
        .eq('restaurante_id', restId)
        .order('fecha_emision', { ascending: false })
        .order('numero', { ascending: false });
      if (e) setError('No se han podido cargar las facturas.');
      setFacturas(data || []);
      setCargando(false);
    }
    init();
  }, []);

  async function descargar(f) {
    setDescargando(f.id);
    setError('');
    try { await descargarPdf(f.id); }
    catch (e) { setError(e.message); }
    finally { setDescargando(null); }
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 bg-bg/80 backdrop-blur-md border-b border-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <FileText className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text">Facturas</h1>
              <p className="text-xs text-text-muted hidden sm:block">Tus facturas de Comandi</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/pedidos" className="btn-ghost">
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Volver</span>
            </a>
            <div className="h-6 w-px bg-border mx-1" />
            <MenuNav />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-lg border text-sm bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {cargando ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-accent" /></div>
        ) : facturas.length === 0 ? (
          <div className="card p-10 text-center">
            <FileText className="w-8 h-8 text-text-muted mx-auto mb-3" />
            <p className="text-text font-medium">Todavía no tienes facturas</p>
            <p className="text-sm text-text-muted mt-1">Aparecerán aquí cada vez que se emita una.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-text-muted border-b border-border">
                    <th className="px-4 py-3 font-medium">Número</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium">Periodo</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {facturas.map((f) => (
                    <tr key={f.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium text-text whitespace-nowrap tabular-nums">
                        {f.numero}
                        {f.tipo === 'rectificativa' && (
                          <span className="ml-2 badge bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Rectificativa</span>
                        )}
                        {f.sustituida && (
                          <span className="ml-2 badge bg-surface-2 text-text-muted border border-border">Sustituida</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap tabular-nums">{fechaCorta(f.fecha_emision)}</td>
                      <td className="px-4 py-3 text-text-muted whitespace-nowrap tabular-nums">{periodoTexto(f)}</td>
                      <td className="px-4 py-3 text-right text-text whitespace-nowrap tabular-nums">{euros(f.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => descargar(f)} disabled={descargando === f.id} className="btn-secondary text-xs whitespace-nowrap">
                          {descargando === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          Descargar PDF
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

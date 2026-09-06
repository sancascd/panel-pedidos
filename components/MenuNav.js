'use client';

// Menú de navegación compartido del panel (botón hamburguesa + desplegable).
// Se usa en todas las páginas para no duplicar la navegación. Resalta la
// sección activa y muestra "Admin" solo a superadmins.
//
// Uso:  <MenuNav />                 -> detecta admin por su cuenta
//       <MenuNav esAdmin={bool} />  -> si la página ya sabe si es admin

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  Menu, X, LayoutDashboard, UtensilsCrossed, Clock,
  Users, BarChart3, Star, Gauge, Settings, Shield, LogOut
} from 'lucide-react';

const LINKS_NAV = [
  { href: '/pedidos',    icono: LayoutDashboard, label: 'Tablero' },
  { href: '/carta',      icono: UtensilsCrossed, label: 'Carta' },
  { href: '/horarios',   icono: Clock,           label: 'Horarios' },
  { href: '/clientes',   icono: Users,           label: 'Clientes' },
  { href: '/analiticas', icono: BarChart3,       label: 'Analíticas' },
  { href: '/resenas',    icono: Star,            label: 'Reseñas' },
  { href: '/plan',       icono: Gauge,           label: 'Plan' },
  { href: '/ajustes',    icono: Settings,        label: 'Ajustes' },
  { href: '/admin',      icono: Shield,          label: 'Admin', soloAdmin: true },
];

// `secciones` deja meter en el desplegable las pestanas de una pagina (lo usa
// /admin). Asi la cabecera no acumula dos filas de navegacion.
//   secciones: [{ id, label, icono, contador }]
export default function MenuNav({ esAdmin: esAdminProp, secciones, seccionActiva, onSeccion }) {
  const pathname = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [esAdmin, setEsAdmin] = useState(esAdminProp === true);
  // Un superadmin sin restaurante vinculado (la cuenta de plataforma) no
  // tiene nada que hacer en Tablero, Carta, etc.: se le deja solo Admin.
  // Si algun dia se vincula a un restaurante para ayudarle, vuelve el menu
  // completo solo.
  const [sinRestaurante, setSinRestaurante] = useState(false);
  const [nombreRestaurante, setNombreRestaurante] = useState('');

  // Si la página no nos dice si es admin, lo consultamos nosotros.
  useEffect(() => {
    if (esAdminProp !== undefined) {
      setEsAdmin(esAdminProp === true);
      return;
    }
    let activo = true;
    const supabase = crearClienteSupabase();
    supabase.rpc('soy_superadmin')
      .then(({ data }) => { if (activo) setEsAdmin(data === true); })
      .catch(() => {});
    return () => { activo = false; };
  }, [esAdminProp]);

  useEffect(() => {
    let activo = true;
    const supabase = crearClienteSupabase();
    supabase.rpc('mi_restaurante_id')
      .then(async ({ data }) => {
        if (!activo) return;
        setSinRestaurante(!data);
        if (!data) { setNombreRestaurante(''); return; }
        const { data: rest } = await supabase
          .from('restaurantes').select('nombre').eq('id', data).maybeSingle();
        if (activo) setNombreRestaurante(rest?.nombre || '');
      })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

  // Solo aparece cuando un superadmin esta DENTRO del panel de un
  // restaurante (entro desde /admin). Deshace el vinculo temporal.
  const dentroDeUnRestaurante = esAdmin && !sinRestaurante;

  async function salirDelPanel() {
    const supabase = crearClienteSupabase();
    const { error } = await supabase.rpc('salir_del_restaurante');
    if (error) { alert('No se pudo salir: ' + error.message); return; }
    window.location.href = '/admin';
  }

  return (
    <>
      {/* Barra fija mientras el superadmin esta dentro del panel de un
          restaurante. Estaba solo en el menu desplegable y se olvidaba:
          volvias a entrar al dia siguiente y seguias dentro sin darte cuenta. */}
      {dentroDeUnRestaurante && (
        <div className="fixed bottom-0 left-0 right-0 z-[60] no-imprimir bg-amber-500 text-black shadow-lift">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium min-w-0">
              Estas viendo el panel de{' '}
              <strong>{nombreRestaurante || 'un restaurante'}</strong> como administradora
            </p>
            <button
              onClick={salirDelPanel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/85 text-white text-sm font-semibold hover:bg-black transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>
      )}

    <div className="relative">
      <button
        onClick={() => setAbierto(v => !v)}
        className="btn-ghost p-2.5"
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Menú de navegación"
      >
        {abierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {abierto && (
        <>
          {/* Capa para cerrar al pulsar fuera */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAbierto(false)}
            aria-hidden
          />
          <div className="absolute right-0 mt-2 w-56 z-50 card shadow-lift p-1.5 animate-fade-in" role="menu">
            {secciones && secciones.length > 0 && (
              <>
                {secciones.map(({ id, label, icono: Icono, contador }) => (
                  <button
                    key={id}
                    onClick={() => { setAbierto(false); onSeccion(id); }}
                    role="menuitem"
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      seccionActiva === id
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-muted hover:text-text hover:bg-surface-2'
                    }`}
                  >
                    <Icono className="w-4 h-4 flex-shrink-0" />
                    {label}
                    {contador ? (
                      <span className="ml-auto tabular-nums text-xs px-1.5 py-0.5 rounded-md bg-surface-2 text-text-muted">
                        {contador}
                      </span>
                    ) : null}
                  </button>
                ))}
                <div className="my-1.5 border-t border-border" />
              </>
            )}
            {dentroDeUnRestaurante && (
              <>
                <button
                  onClick={() => { setAbierto(false); salirDelPanel(); }}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  Salir del panel
                </button>
                <div className="my-1.5 border-t border-border" />
              </>
            )}
            {(esAdmin && sinRestaurante
              ? LINKS_NAV.filter(l => l.soloAdmin)
              : LINKS_NAV
            ).map(({ href, icono: Icono, label, soloAdmin }) => (
              (!soloAdmin || esAdmin) && (
                <a
                  key={href}
                  href={href}
                  role="menuitem"
                  onClick={() => setAbierto(false)}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    pathname === href
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-muted hover:text-text hover:bg-surface-2'
                  }`}
                >
                  <Icono className="w-4 h-4 flex-shrink-0" />
                  {label}
                </a>
              )
            ))}
          </div>
        </>
      )}
    </div>
    </>
  );
}

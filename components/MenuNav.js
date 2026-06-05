'use client';

// Menú de navegación compartido del panel (botón hamburguesa + desplegable).
// Se usa en todas las páginas para no duplicar la navegación. Resalta la
// sección activa y muestra "Admin" solo a superadmins.
//
// Uso:  <MenuNav />                 -> detecta admin por su cuenta
//       <MenuNav esAdmin={bool} />  -> si la página ya sabe si es admin

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  Menu, X, LayoutDashboard, ChefHat, UtensilsCrossed, Clock,
  Users, BarChart3, Star, Gauge, Settings, Shield
} from 'lucide-react';

const LINKS_NAV = [
  { href: '/pedidos',    icono: LayoutDashboard, label: 'Tablero' },
  { href: '/cocina',     icono: ChefHat,         label: 'Cocina' },
  { href: '/carta',      icono: UtensilsCrossed, label: 'Carta' },
  { href: '/horarios',   icono: Clock,           label: 'Horarios' },
  { href: '/clientes',   icono: Users,           label: 'Clientes' },
  { href: '/analiticas', icono: BarChart3,       label: 'Analíticas' },
  { href: '/resenas',    icono: Star,            label: 'Reseñas' },
  { href: '/plan',       icono: Gauge,           label: 'Plan' },
  { href: '/ajustes',    icono: Settings,        label: 'Ajustes' },
  { href: '/admin',      icono: Shield,          label: 'Admin', soloAdmin: true },
];

export default function MenuNav({ esAdmin: esAdminProp }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [esAdmin, setEsAdmin] = useState(esAdminProp === true);

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

  return (
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
            {LINKS_NAV.map(({ href, icono: Icono, label, soloAdmin }) => (
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
  );
}

// El desplegable de la administradora, igual en /admin y en /admin/facturacion.
// Orden decidido por Sandra (2026-09-15).
import { BarChart3, Store, Gauge, Briefcase, Receipt } from 'lucide-react';

export const SECCIONES_ADMIN = [
  { id: 'dashboard',    label: 'Dashboard',    icono: BarChart3 },
  { id: 'restaurantes', label: 'Restaurantes', icono: Store },
  { id: 'planes',       label: 'Planes',       icono: Gauge },
  { id: 'comerciales',  label: 'Comerciales',  icono: Briefcase },
  { id: 'facturacion',  label: 'Facturación',  icono: Receipt },
];

// Adónde lleva cada entrada desde otra página.
export function rutaSeccionAdmin(id) {
  return id === 'facturacion' ? '/admin/facturacion' : '/admin?seccion=' + id;
}

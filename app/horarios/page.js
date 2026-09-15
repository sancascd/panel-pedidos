'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Los horarios se editan dentro de Ajustes (Sandra, 2026-09-15). Esta dirección
// se queda para los enlaces viejos y lleva allí con el apartado abierto.
export default function PaginaHorarios() {
  const router = useRouter();
  useEffect(() => { router.replace('/ajustes?abrir=horarios'); }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <Loader2 className="w-6 h-6 animate-spin text-accent" />
    </div>
  );
}

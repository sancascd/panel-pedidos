'use client';

// Interruptor de modo claro/oscuro. La preferencia se guarda en
// localStorage ('comandi-tema-v2', misma clave que lee el script de
// app/layout.js para aplicar el tema antes del primer pintado y evitar el
// parpadeo blanco).

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function BotonTema() {
  const [modoOscuro, setModoOscuro] = useState(false);

  useEffect(() => {
    try {
      setModoOscuro(localStorage.getItem('comandi-tema-v2') === 'dark');
    } catch (e) { /* localStorage bloqueado: se queda en claro */ }
  }, []);

  function alternarTema() {
    const nuevo = !modoOscuro;
    setModoOscuro(nuevo);
    document.documentElement.classList.toggle('dark', nuevo);
    try {
      localStorage.setItem('comandi-tema-v2', nuevo ? 'dark' : 'light');
    } catch (e) {}
  }

  return (
    <button
      onClick={alternarTema}
      className="btn-ghost p-2.5"
      title={modoOscuro ? 'Modo claro' : 'Modo oscuro'}
      aria-label={modoOscuro ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
    >
      {modoOscuro ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

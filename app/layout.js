@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --font-sans: 'Inter', ui-sans-serif, system-ui, -apple-system, sans-serif;

  /* MODO CLARO */
  --bg: 250 250 250;            /* fondo general (zinc-50) */
  --surface: 255 255 255;       /* tarjetas, modales (blanco) */
  --surface-2: 244 244 245;     /* fondos sutiles (zinc-100) */
  --border: 228 228 231;        /* bordes (zinc-200) */
  --text: 24 24 27;             /* texto principal (zinc-900) */
  --text-muted: 113 113 122;    /* texto secundario (zinc-500) */
  --accent: 16 185 129;         /* verde eléctrico */
  --accent-hover: 5 150 105;    /* verde hover */
}

.dark {
  /* MODO OSCURO */
  --bg: 9 9 11;                 /* fondo general (zinc-950) */
  --surface: 24 24 27;          /* tarjetas, modales (zinc-900) */
  --surface-2: 39 39 42;        /* fondos sutiles (zinc-800) */
  --border: 39 39 42;           /* bordes (zinc-800) */
  --text: 250 250 250;          /* texto principal (zinc-50) */
  --text-muted: 161 161 170;    /* texto secundario (zinc-400) */
  --accent: 16 185 129;         /* verde eléctrico (igual) */
  --accent-hover: 52 211 153;   /* verde hover (más claro en oscuro) */
}

* {
  border-color: rgb(var(--border));
}

html {
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-sans);
  background-color: rgb(var(--bg));
  color: rgb(var(--text));
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  transition: background-color 0.2s ease, color 0.2s ease;
}

/* Inputs y selects con estilo consistente */
input, textarea, select {
  background-color: rgb(var(--surface));
  color: rgb(var(--text));
  border-color: rgb(var(--border));
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: rgb(var(--accent));
  box-shadow: 0 0 0 3px rgb(16 185 129 / 0.15);
}

/* Scrollbar moderno */
::-webkit-scrollbar {
  width: 10px;
  height: 10px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgb(var(--border));
  border-radius: 8px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgb(var(--text-muted));
}

/* Componentes reutilizables */
@layer components {
  .btn-primary {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
           bg-accent hover:bg-accent-hover text-white
           transition-all duration-150 ease-out
           disabled:opacity-40 disabled:cursor-not-allowed
           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg;
  }

  .btn-secondary {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
           bg-surface-2 hover:bg-border text-text border border-border
           transition-all duration-150 ease-out;
  }

  .btn-ghost {
    @apply inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
           text-text-muted hover:text-text hover:bg-surface-2
           transition-all duration-150 ease-out;
  }

  .btn-danger {
    @apply inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm
           bg-red-500 hover:bg-red-600 text-white
           transition-all duration-150 ease-out;
  }

  .card {
    @apply bg-surface border border-border rounded-xl shadow-card
           transition-shadow duration-200;
  }

  .input {
    @apply w-full px-3 py-2.5 rounded-lg border border-border text-sm
           bg-surface text-text placeholder:text-text-muted;
  }

  .label {
    @apply block text-sm font-medium text-text mb-1.5;
  }

  .badge {
    @apply inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium;
  }

  .nav-link {
    @apply inline-flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm
           text-text-muted hover:text-text hover:bg-surface-2
           transition-all duration-150;
  }
}

/* Fix para impresion de ticket (mantener compatibilidad) */
@media print {
  body { background: white !important; color: black !important; }
}

'use client';

// Captura errores de renderizado de React que no maneja Next por defecto.
// Sentry recomienda este archivo en App Router para no perder esos errores.

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '1rem',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        backgroundColor: '#0a0a0b',
        color: '#fafafa'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600 }}>Algo ha fallado</h1>
        <p style={{ color: '#a1a1aa', maxWidth: '32rem', textAlign: 'center' }}>
          Ha ocurrido un error inesperado. Ya lo hemos registrado y lo estamos mirando.
        </p>
        <button
          onClick={() => reset()}
          style={{
            padding: '0.5rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            backgroundColor: '#10b981',
            color: 'white',
            fontWeight: 500,
            cursor: 'pointer'
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}

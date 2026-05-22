// Instrumentation oficial de Next.js para Sentry.
// Reemplaza a sentry.server.config.js y sentry.edge.config.js.
// Next.js llama a register() automaticamente al arrancar.

import * as Sentry from '@sentry/nextjs';

export async function register() {
  const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!SENTRY_DSN) return;

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.1,
    });
  }
}

// Hook para capturar errores que se cuelan a Sentry sin pasar por el handler.
export const onRequestError = Sentry.captureRequestError;

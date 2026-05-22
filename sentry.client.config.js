// Sentry config para el navegador (panel del restaurante).
// Captura errores del lado cliente: clicks, fetches fallidos, exceptions JS.

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    // Solo el 10% de transacciones para no quemar la cuota free
    tracesSampleRate: 0.1,
    // Solo registrar sesiones de replay con error (no todas)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    ignoreErrors: [
      // Errores conocidos que no queremos rastrear
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      // Errores de extensiones del navegador
      /^chrome-extension:/,
      /^moz-extension:/
    ]
  });
}

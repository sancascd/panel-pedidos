// Instrumentation del cliente (navegador).
// Reemplaza a sentry.client.config.js. Next.js lo carga automaticamente.

import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
      /^chrome-extension:/,
      /^moz-extension:/
    ]
  });
}

// Hook que Next.js llama cuando hay un error de navegacion
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

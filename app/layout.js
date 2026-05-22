import './globals.css';

export const metadata = {
  metadataBase: new URL('https://comandi.es'),
  title: {
    default: 'Comandi — Pedidos por WhatsApp con IA para restaurantes',
    template: '%s · Comandi'
  },
  description: 'Asistente de WhatsApp con IA que toma los pedidos por ti. Pensado para restaurantes pequeños y medianos en España.',
  keywords: ['pedidos whatsapp', 'restaurante', 'IA', 'bot whatsapp', 'comandi', 'pedidos online'],
  authors: [{ name: 'Comandi' }],
  creator: 'Comandi',
  publisher: 'Comandi',
  openGraph: {
    type: 'website',
    locale: 'es_ES',
    url: 'https://comandi.es',
    siteName: 'Comandi',
    title: 'Comandi — Pedidos por WhatsApp con IA para restaurantes',
    description: 'Asistente de WhatsApp con IA que toma los pedidos por ti. Pensado para restaurantes pequeños y medianos en España.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comandi — Pedidos por WhatsApp con IA',
    description: 'Asistente de WhatsApp con IA que toma los pedidos por ti.',
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://comandi.es',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        {/*
          CSS crítico INLINE en HTML — parseado por el navegador antes que
          cualquier script o stylesheet externo. Garantiza que body siempre
          tiene fondo definido desde el primer paint, sin flash gris.
        */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html { color-scheme: light; background-color: rgb(250 250 250); }
              html.dark { color-scheme: dark; background-color: rgb(9 9 11); }
              body {
                margin: 0;
                background-color: rgb(250 250 250);
                color: rgb(24 24 27);
              }
              html.dark body {
                background-color: rgb(9 9 11);
                color: rgb(250 250 250);
              }
            `,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (localStorage.getItem('theme') === 'dark') {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

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
    images: [
      {
        url: '/og-image.png',  // 1200x630, generar despues
        width: 1200,
        height: 630,
        alt: 'Comandi — Pedidos por WhatsApp con IA'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Comandi — Pedidos por WhatsApp con IA',
    description: 'Asistente de WhatsApp con IA que toma los pedidos por ti.',
    images: ['/og-image.png']
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: 'https://comandi.es',
  },
};

// Schema.org JSON-LD para que Google entienda que esto es un SaaS B2B.
// Mejora apariencia en resultados de busqueda (rich snippets) y SEO general.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Comandi',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'Order Management',
  operatingSystem: 'Web',
  description: 'Asistente de WhatsApp con IA que toma pedidos para restaurantes españoles.',
  url: 'https://comandi.es',
  inLanguage: 'es-ES',
  offers: {
    '@type': 'Offer',
    priceCurrency: 'EUR',
    availability: 'https://schema.org/PreOrder'
  },
  publisher: {
    '@type': 'Organization',
    name: 'Comandi',
    url: 'https://comandi.es',
    email: 'info@comandi.es',
    areaServed: { '@type': 'Country', name: 'Spain' }
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        {/*
          color-scheme: SOLO light. Antes ponia "light dark" y el navegador,
          al detectar que el sistema esta en modo oscuro, pre-pintaba elementos
          nativos (fondo, scrollbars, controls) en gris/oscuro durante el FOUC
          antes de aplicar nuestro CSS. Eso causaba el "destello grisaceo" al
          refrescar. Con "light", el navegador siempre asume claro y no hay
          flash. El toggle manual sigue funcionando (cambia clases + CSS vars).
        */}
        <meta name="color-scheme" content="light" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
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
                  // Clave nueva 'comandi-tema-v2' para invalidar el viejo 'theme'
                  // que pudiera haber quedado a 'dark' en localStorage. Default = light.
                  if (localStorage.getItem('comandi-tema-v2') === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
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

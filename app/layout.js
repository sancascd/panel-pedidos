import './globals.css';

export const metadata = {
  title: 'Comandi',
  description: 'Recibe pedidos por WhatsApp en tu restaurante',
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

import './globals.css';

export const metadata = {
  title: 'Comandi',
  description: 'Recibe pedidos por WhatsApp en tu restaurante',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // La landing pública (/) siempre se ve en oscuro
                  if (window.location.pathname === '/') {
                    document.documentElement.classList.add('dark');
                    return;
                  }
                  // El resto de páginas respetan la preferencia del usuario
                  var theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
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

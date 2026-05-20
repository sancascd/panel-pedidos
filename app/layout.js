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
                  // Solo respeta la elección manual del usuario (sin mirar la preferencia del sistema)
                  var isDark = localStorage.getItem('theme') === 'dark';
                  if (isDark) {
                    document.documentElement.classList.add('dark');
                  }
                  // Inyectamos las variables CSS del tema inline en <head>, así están
                  // disponibles ANTES de que cargue ningún CSS externo. Esto evita el
                  // flash gris al recargar el panel.
                  var vars = isDark
                    ? '--bg: 9 9 11; --surface: 24 24 27; --surface-2: 39 39 42; --border: 39 39 42; --text: 250 250 250; --text-muted: 161 161 170; --accent: 16 185 129; --accent-hover: 52 211 153; color-scheme: dark;'
                    : '--bg: 250 250 250; --surface: 255 255 255; --surface-2: 244 244 245; --border: 228 228 231; --text: 24 24 27; --text-muted: 113 113 122; --accent: 16 185 129; --accent-hover: 5 150 105; color-scheme: light;';
                  var bgInicial = isDark ? 'rgb(9 9 11)' : 'rgb(250 250 250)';
                  var textInicial = isDark ? 'rgb(250 250 250)' : 'rgb(24 24 27)';
                  var s = document.createElement('style');
                  s.id = 'comandi-theme-preload';
                  s.textContent = 'html{' + vars + '}body{background-color:' + bgInicial + ';color:' + textInicial + ';}';
                  document.head.appendChild(s);
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

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

import './globals.css';

export const metadata = {
  title: 'Panel de Pedidos',
  description: 'Gestión de pedidos para restaurantes',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className="bg-gray-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}

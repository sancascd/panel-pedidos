// Robots.txt generado por Next.js en /robots.txt
// Bloqueamos paths privados (panel logueado) y permitimos los publicos.

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/registro', '/aviso-legal', '/privacidad', '/contacto'],
        disallow: [
          '/pedidos',
          '/cocina',
          '/clientes',
          '/carta',
          '/horarios',
          '/ajustes',
          '/admin',
          '/resenas',
        ],
      },
    ],
    sitemap: 'https://comandi.es/sitemap.xml',
  };
}

// Robots.txt generado por Next.js en /robots.txt
// Bloqueamos paths privados (panel logueado) y permitimos los publicos.

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/login', '/registro', '/recuperar-contrasena', '/aviso-legal', '/privacidad', '/contacto', '/comerciales'],
        disallow: [
          '/pedidos',
          '/clientes',
          '/carta',
          '/horarios',
          '/ajustes',
          '/admin',
          '/resenas',
          '/comercial',           // panel privado del comercial
          '/equipo',              // cifras de la red comercial
          '/cambiar-contrasena',  // requiere token de email
        ],
      },
    ],
    sitemap: 'https://comandi.es/sitemap.xml',
  };
}

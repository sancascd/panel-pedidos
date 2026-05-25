// Sitemap generado dinamicamente por Next.js en /sitemap.xml
// Solo incluye paginas PUBLICAS (no las de admin que requieren login).

export default function sitemap() {
  const base = 'https://comandi.es';
  const lastMod = new Date().toISOString();

  return [
    {
      url: base,
      lastModified: lastMod,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: base + '/login',
      lastModified: lastMod,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: base + '/registro',
      lastModified: lastMod,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: base + '/aviso-legal',
      lastModified: lastMod,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: base + '/privacidad',
      lastModified: lastMod,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: base + '/contacto',
      lastModified: lastMod,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}

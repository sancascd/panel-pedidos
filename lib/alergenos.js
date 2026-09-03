// Los 14 alérgenos de declaración obligatoria (Reglamento UE 1169/2011).
// Se guardan por `id` en productos.alergenos_contiene / alergenos_trazas.
export const ALERGENOS = [
  { id: 'gluten', label: 'Gluten' },
  { id: 'crustaceos', label: 'Crustáceos' },
  { id: 'huevo', label: 'Huevo' },
  { id: 'pescado', label: 'Pescado' },
  { id: 'cacahuete', label: 'Cacahuetes' },
  { id: 'soja', label: 'Soja' },
  { id: 'leche', label: 'Leche' },
  { id: 'frutos_cascara', label: 'Frutos de cáscara' },
  { id: 'apio', label: 'Apio' },
  { id: 'mostaza', label: 'Mostaza' },
  { id: 'sesamo', label: 'Sésamo' },
  { id: 'sulfitos', label: 'Sulfitos' },
  { id: 'altramuces', label: 'Altramuces' },
  { id: 'molusco', label: 'Moluscos' },
];

const MAPA = ALERGENOS.reduce((m, a) => { m[a.id] = a.label; return m; }, {});

// 'gluten' -> 'Gluten'. Si llega un id desconocido, lo devuelve tal cual.
export function etiquetaAlergeno(id) {
  return MAPA[id] || id;
}

// ['gluten','soja'] -> 'Gluten, Soja'
export function listaAlergenos(ids) {
  return (ids || []).map(etiquetaAlergeno).join(', ');
}

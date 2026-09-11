// Enlazar lo que lleva un menú con los platos de la carta.
//
// Cocina se guía por el número del plato, y ese número solo existe si cada
// plato del menú apunta a su producto. Enlazarlo a mano, plato por plato, es
// justo lo que se olvida o se hace mal; aquí se propone solo.
//
// Sin IA y sin adivinar: se comparan las PALABRAS del texto con las del plato
// ("2 arroces fritos tres delicias" con "Arroz frito tres delicias"). Lo que
// casa sin dudas se marca como seguro; lo demás se propone y decide una
// persona, porque un número equivocado manda a cocina a hacer otro plato.

// Palabras que no dicen qué plato es.
const VACIAS = new Set([
  'de', 'del', 'con', 'la', 'el', 'los', 'las', 'al', 'a', 'en', 'y', 'e',
  'o', 'u', 'un', 'una', 'unos', 'unas', 'x', 'estilo', 'incluido', 'incluida',
]);

const CIFRAS = { '1': 'uno', '2': 'dos', '3': 'tres', '4': 'cuatro', '5': 'cinco' };

function sinTildes(s) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Singular aproximado, igual para los dos lados: "arroces" y "arroz" acaban
// en lo mismo, y "champiñones" y "champiñón" también.
function raiz(t) {
  if (t.length <= 3) return t;
  if (t.endsWith('ces')) return t.slice(0, -3) + 'z';
  if (/(les|nes|res|des)$/.test(t)) return t.slice(0, -2);
  if (t.endsWith('s')) return t.slice(0, -1);
  return t;
}

export function palabras(texto) {
  return sinTildes(texto)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')          // "(6 piezas)", "(surtido salteado)"
    .replace(/[^a-z0-9ñ]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((t) => CIFRAS[t] || t)
    .filter((t) => !VACIAS.has(t))
    .map(raiz);
}

// El plato de la carta que mejor casa con un texto, o null.
//   seguro: están TODAS las palabras del texto, el plato no añade casi nada
//           más y no hay otro plato igual de bueno.
//   alternativas: los mejores candidatos, para elegir cuando no es seguro.
export function mejorPlato(texto, productos) {
  const q = palabras(texto);
  if (q.length === 0) return null;
  const candidatos = [];
  for (const p of productos || []) {
    const pp = palabras(p.nombre);
    if (pp.length === 0) continue;
    const delPlato = new Set(pp);
    const cobertura = q.filter((w) => delPlato.has(w)).length / q.length;
    if (cobertura < 0.6) continue;
    const sobran = pp.filter((w) => !q.includes(w)).length;
    candidatos.push({ producto: p, cobertura, sobran });
  }
  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => b.cobertura - a.cobertura || a.sobran - b.sobran);
  const [a, b] = candidatos;
  const empate = b && b.cobertura === a.cobertura && b.sobran === a.sobran;
  // Con una sola palabra ("pollo") hace falta que el plato casi no añada nada.
  const margen = q.length === 1 ? 1 : 2;
  const seguro = a.cobertura === 1 && a.sobran <= margen && !empate;
  return {
    producto: a.producto,
    seguro,
    alternativas: candidatos.slice(0, 5).map((c) => c.producto),
  };
}

// "2 rollos de primavera" -> { cantidad: 2, texto: 'rollos de primavera' }
export function leerLinea(linea) {
  let texto = String(linea || '').trim().replace(/^[-•*·]\s*/, '');
  let cantidad = 1;
  const m = texto.match(/^(\d{1,2})\s*(?:x\s+|x(?=\d)|\s)(.+)$/i);
  if (m) { cantidad = parseInt(m[1], 10) || 1; texto = m[2].trim(); }
  return { cantidad, texto };
}

// Una lista escrita (la descripción de un menú cerrado, o lo que se pegue)
// convertida en platos propuestos, cada uno con su enlace si lo hay.
export function proponerPlatos(lista, productos) {
  return String(lista || '')
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const { cantidad, texto } = leerLinea(l);
      const m = mejorPlato(texto, productos);
      return {
        cantidad,
        texto,
        producto: m ? m.producto : null,
        seguro: !!(m && m.seguro),
        alternativas: m ? m.alternativas : [],
      };
    });
}

// Helpers para construir filtros de búsqueda seguros y predecibles contra la
// mini-sintaxis de filtros de PostgREST (Supabase) y contra los comodines de LIKE.
//
// CONTEXTO
// El panel filtra el historial de pedidos por nombre/teléfono (con .or()) y por
// producto (con .ilike()). El texto que escribe el usuario se interpola en la
// sintaxis de filtros de PostgREST. Aunque RLS ya limita los datos al propio
// restaurante (no hay fuga entre clientes), un input con caracteres especiales
// (",", "(", ")", ".", "%", "_") podía:
//   - romper el filtro (error 400) → la búsqueda no devuelve nada, o
//   - cambiar el significado de la búsqueda (p.ej. "%" actuaba como comodín).
// El enfoque anterior BORRABA "," "(" ")", lo que además estropeaba búsquedas
// legítimas como "García, S.L." o "Sr. Pérez".
//
// SOLUCIÓN
// 1) Escapar los comodines de LIKE para que la búsqueda sea literal.
// 2) Para .or(), entrecomillar el valor (forma correcta de PostgREST): así las
//    comas/paréntesis/puntos del input se tratan como TEXTO, no como sintaxis.

// Escapa los comodines de SQL LIKE/ILIKE para que la búsqueda sea LITERAL.
// Quien escribe "50%" busca el texto "50%", no "todo lo que empiece por 50".
// Se escapan  \  %  _  con el carácter de escape por defecto de LIKE (\).
export function escaparComodinesLike(texto) {
  return String(texto ?? '').replace(/[\\%_]/g, (c) => '\\' + c);
}

// Construye un valor «contiene X» (%X%) entrecomillado y escapado para usarlo
// DENTRO de un filtro de PostgREST como .or(). Las comillas dobles hacen que
// las comas, paréntesis y puntos del input se traten como texto literal y no
// como separadores/sintaxis del filtro. Dentro de las comillas, los caracteres
// reservados de PostgREST  \  y  "  se escapan con  \ .
//
// Devuelve, por ejemplo:  "%García, S.L.%"  (con las comillas incluidas).
export function valorContienePostgrest(texto) {
  const patron = `%${escaparComodinesLike(texto)}%`;
  const escapado = patron.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escapado}"`;
}

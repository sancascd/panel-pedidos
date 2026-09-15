// Comprueba un NIF español: DNI, NIE o CIF de empresa, con su dígito o letra
// de control. Devuelve null si está bien o el motivo si no.

const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

export function limpiarNif(nif) {
  return String(nif || '').toUpperCase().replace(/[\s.\-]/g, '');
}

export function errorNif(nifSucio) {
  const nif = limpiarNif(nifSucio);
  if (!nif) return 'Falta el NIF o CIF';

  // DNI: 8 números + letra
  if (/^\d{8}[A-Z]$/.test(nif)) {
    return LETRAS_DNI[parseInt(nif.slice(0, 8), 10) % 23] === nif[8] ? null : 'La letra del DNI no cuadra';
  }
  // NIE: X/Y/Z + 7 números + letra
  if (/^[XYZ]\d{7}[A-Z]$/.test(nif)) {
    const num = 'XYZ'.indexOf(nif[0]) + nif.slice(1, 8);
    return LETRAS_DNI[parseInt(num, 10) % 23] === nif[8] ? null : 'La letra del NIE no cuadra';
  }
  // CIF: letra + 7 números + control (número o letra)
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(nif)) {
    const digitos = nif.slice(1, 8);
    let suma = 0;
    for (let i = 0; i < 7; i++) {
      let n = parseInt(digitos[i], 10);
      if (i % 2 === 0) { n *= 2; if (n > 9) n -= 9; }
      suma += n;
    }
    const control = (10 - (suma % 10)) % 10;
    const letra = 'JABCDEFGHI'[control];
    const final = nif[8];
    // Unas letras de sociedad llevan control en letra, otras en número, y
    // algunas admiten las dos.
    if ('PQRSNW'.includes(nif[0])) return final === letra ? null : 'El dígito de control del CIF no cuadra';
    if ('ABEH'.includes(nif[0])) return final === String(control) ? null : 'El dígito de control del CIF no cuadra';
    return final === String(control) || final === letra ? null : 'El dígito de control del CIF no cuadra';
  }
  return 'No parece un NIF, NIE ni CIF español (9 caracteres)';
}

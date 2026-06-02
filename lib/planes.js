// ============================================================
// Definición central de planes + lógica de consumo/overage.
// Fuente única de verdad: la usan el panel (/plan, /admin) y la landing.
// ============================================================
//
// IMPORTANTE: todos los precios están CON IVA incluido (el cliente paga lo
// que ve). Sandra se queda con precio / 1.21.

export const PLANES = {
  basico: {
    id: 'basico',
    nombre: 'Básico',
    precio: 99,
    pedidosIncluidos: 600,
    overage: 0.20,
  },
  pro: {
    id: 'pro',
    nombre: 'Pro',
    precio: 149,
    pedidosIncluidos: 1500,
    overage: 0.12,
  },
  premium: {
    id: 'premium',
    nombre: 'Premium',
    precio: 249,
    pedidosIncluidos: 3500,
    overage: 0.08,
  },
};

// Orden ascendente de planes (para "siguiente plan").
export const ORDEN_PLANES = ['basico', 'pro', 'premium'];

// Cuota de implementación única al alta.
export const SETUP_FEE = 119;

// Descuento por pago anual (12 meses por adelantado).
export const DESCUENTO_ANUAL = 0.10; // 10%

// Umbrales de aviso (sobre pedidos consumidos / incluidos).
export const UMBRAL_AVISO = 0.80;   // 80% -> "te acercas"
export const UMBRAL_LIMITE = 1.00;  // 100% -> "alcanzado"
export const UMBRAL_EXCESO = 1.20;  // 120% -> "overage notable"

// Devuelve la info de un plan. Si el id no existe, cae a 'basico' (defensivo).
export function infoPlan(planId) {
  return PLANES[planId] || PLANES.basico;
}

// Id del plan inmediatamente superior, o null si ya es el más alto.
export function planSiguiente(planId) {
  const i = ORDEN_PLANES.indexOf(planId);
  if (i === -1 || i >= ORDEN_PLANES.length - 1) return null;
  return ORDEN_PLANES[i + 1];
}

// Precio anual con descuento aplicado (12 meses - descuento).
export function precioAnual(planId) {
  const p = infoPlan(planId);
  return Math.round(p.precio * 12 * (1 - DESCUENTO_ANUAL));
}

// Equivalente mensual del plan anual (para mostrar "X€/mes pagando al año").
export function precioMensualEquivalenteAnual(planId) {
  return Math.round((precioAnual(planId) / 12) * 100) / 100;
}

// ============================================================
// Periodo de facturación: MES DESDE LA FECHA DE ALTA (rolling).
// Si el restaurante se dio de alta el 12 de mayo, sus periodos son
// 12may-12jun, 12jun-12jul, etc. Devolvemos el periodo que contiene `ahora`.
// ============================================================
export function periodoActual(fechaAltaISO, ahora = Date.now()) {
  const alta = new Date(fechaAltaISO);
  const ahoraMs = typeof ahora === 'number' ? ahora : new Date(ahora).getTime();

  // Si la fecha de alta no es válida, usamos un periodo de 30 días desde ahora
  // hacia atrás como fallback defensivo.
  if (isNaN(alta.getTime())) {
    const fin = new Date(ahoraMs);
    const inicio = new Date(ahoraMs - 30 * 24 * 60 * 60 * 1000);
    return { inicio, fin, diasTranscurridos: 30, diasTotales: 30 };
  }

  // Avanzamos mes a mes desde la fecha de alta hasta encontrar el periodo
  // [inicio, fin) que contiene `ahora`.
  let inicio = new Date(alta.getTime());
  // Si ahora es anterior al alta (raro), el periodo es [alta, alta+1mes).
  if (ahoraMs < inicio.getTime()) {
    const fin = sumarUnMes(inicio);
    return calcularDias(inicio, fin, inicio.getTime());
  }

  let fin = sumarUnMes(inicio);
  // Tope de seguridad para no iterar infinito (120 meses = 10 años).
  let guard = 0;
  while (fin.getTime() <= ahoraMs && guard < 120) {
    inicio = fin;
    fin = sumarUnMes(inicio);
    guard++;
  }
  return calcularDias(inicio, fin, ahoraMs);
}

// Suma 1 mes a una fecha respetando el día de alta (con overflow nativo de JS:
// 31 ene + 1 mes -> 3 mar en años no bisiestos; aceptable para facturación).
function sumarUnMes(fecha) {
  const d = new Date(fecha.getTime());
  d.setMonth(d.getMonth() + 1);
  return d;
}

function calcularDias(inicio, fin, ahoraMs) {
  const msDia = 24 * 60 * 60 * 1000;
  const diasTotales = Math.max(1, Math.round((fin.getTime() - inicio.getTime()) / msDia));
  const diasTranscurridos = Math.max(0, Math.min(diasTotales, Math.floor((ahoraMs - inicio.getTime()) / msDia) + 1));
  return { inicio, fin, diasTranscurridos, diasTotales };
}

// ============================================================
// Cálculo de consumo del periodo actual.
// Recibe: planId, pedidos consumidos en el periodo, días transcurridos/totales.
// Devuelve métricas listas para pintar en el panel.
// ============================================================
export function calcularConsumo({ planId, pedidosPeriodo, diasTranscurridos, diasTotales }) {
  const plan = infoPlan(planId);
  const incluidos = plan.pedidosIncluidos;
  const consumidos = Math.max(0, pedidosPeriodo || 0);

  const porcentaje = incluidos > 0 ? consumidos / incluidos : 0;
  const overagePedidos = Math.max(0, consumidos - incluidos);
  const overageCoste = Math.round(overagePedidos * plan.overage * 100) / 100;

  // Proyección lineal a fin de periodo: ritmo actual extrapolado.
  let proyeccion = consumidos;
  if (diasTranscurridos >= 1 && diasTotales >= 1) {
    proyeccion = Math.round((consumidos / diasTranscurridos) * diasTotales);
  }
  const overagePedidosProyectado = Math.max(0, proyeccion - incluidos);
  const overageCosteProyectado = Math.round(overagePedidosProyectado * plan.overage * 100) / 100;

  // Coste total estimado a fin de mes (cuota + overage proyectado).
  const costeEstimadoMes = Math.round((plan.precio + overageCosteProyectado) * 100) / 100;

  // Nivel de aviso según consumo REAL (no proyección).
  let nivelAviso = null;
  if (porcentaje >= UMBRAL_EXCESO) nivelAviso = 'exceso';
  else if (porcentaje >= UMBRAL_LIMITE) nivelAviso = 'limite';
  else if (porcentaje >= UMBRAL_AVISO) nivelAviso = 'aviso';

  return {
    plan,
    incluidos,
    consumidos,
    porcentaje,                       // 0..n (puede pasar de 1)
    porcentajeBarra: Math.min(1, porcentaje), // para la barra visual (cap 100%)
    overagePedidos,
    overageCoste,
    proyeccion,
    overagePedidosProyectado,
    overageCosteProyectado,
    costeEstimadoMes,
    nivelAviso,                       // null | 'aviso' | 'limite' | 'exceso'
  };
}

// ============================================================
// Recomendación de upgrade.
// Compara el coste estimado a fin de mes en el plan actual (cuota + overage
// proyectado) contra el coste en el plan siguiente. Si el siguiente sale más
// barato o igual, recomienda subir. Devuelve null si no hay nada que recomendar.
// ============================================================
export function recomendacionUpgrade({ planId, proyeccion }) {
  const siguienteId = planSiguiente(planId);
  if (!siguienteId) return null; // ya está en el plan más alto

  const actual = infoPlan(planId);
  const siguiente = infoPlan(siguienteId);

  const costeActual = actual.precio + Math.max(0, proyeccion - actual.pedidosIncluidos) * actual.overage;
  const costeSiguiente = siguiente.precio + Math.max(0, proyeccion - siguiente.pedidosIncluidos) * siguiente.overage;

  // Solo recomendamos si el cliente YA proyecta superar su plan actual
  // (si no, no tiene sentido empujarle a pagar más).
  const superaActual = proyeccion > actual.pedidosIncluidos;
  if (!superaActual) return null;

  const ahorro = Math.round((costeActual - costeSiguiente) * 100) / 100;

  return {
    siguienteId,
    siguiente,
    costeActual: Math.round(costeActual * 100) / 100,
    costeSiguiente: Math.round(costeSiguiente * 100) / 100,
    ahorro,                  // >0 = le sale más barato el siguiente plan
    recomendar: ahorro >= 0, // recomienda subir si iguala o mejora coste
  };
}

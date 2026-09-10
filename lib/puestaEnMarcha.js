// El proceso de alta de un restaurante, de principio a fin.
//
// Vive aquí y no en la base de datos a propósito: es EL proceso de Comandi y
// mejora con el producto. Si mañana se añade una función, su paso aparece solo
// en todos los restaurantes. Si cada uno tuviera su lista editable acabaríamos
// con un proceso distinto por cliente y ninguno bueno.
//
// Los `id` son la clave de `puesta_en_marcha.paso`: NO se renombran. Un paso
// que se retira deja su fila huérfana, que se ignora sola.

export const FASES = [
  {
    id: 'antes',
    titulo: 'Antes de la visita',
    detalle: 'Lo que no se puede resolver estando allí.',
    pasos: [
      { id: 'ficha-creada', titulo: 'Ficha del restaurante creada',
        detalle: 'Con sql/alta_restaurante.sql, que comprueba que el slug y el número no estén cogidos. '
          + 'A mano no: así acabó Gran Muralla con un estado que el panel no entiende.' },
      { id: 'carta-cargada', titulo: 'Carta cargada',
        detalle: 'Platos, precios y categorías. Con sus números, que es por lo que se guían en cocina.' },
      { id: 'carta-sin-alcohol', titulo: 'Carta revisada sin alcohol',
        detalle: 'WhatsApp prohíbe venderlo, y basta con que un nombre lo mencione. Buscar vino, cerveza, whisky, cava, licor…',
        critico: true },
      { id: 'alergenos', titulo: 'Alérgenos cargados',
        detalle: 'Contiene y trazas. La validación final es del restaurante: es responsabilidad legal suya.' },
      { id: 'horarios', titulo: 'Horarios configurados',
        detalle: 'Los dos turnos de cada día. Ojo si cierran pasada medianoche: ese turno se descarta entero.',
        critico: true },
      { id: 'menus', titulo: 'Menús del día, si tienen' },
      { id: 'whatsapp-alta', titulo: 'Número de WhatsApp dado de alta en Meta',
        detalle: 'Registrar el número por API (con el PIN) ANTES de poner la verificación en dos pasos.' },
      { id: 'whatsapp-perfil', titulo: 'Perfil de WhatsApp: nombre, foto y descripción',
        detalle: 'Sin lenguaje promocional ni alcohol: el perfil también pasa revisión.' },
      { id: 'cuenta-cliente', titulo: 'Su cuenta creada y vinculada',
        detalle: 'Alta en Supabase con "Auto Confirm User" e insert en usuarios_restaurante. Nunca con /registro.' },
      { id: 'plan', titulo: 'Plan y pedidos incluidos puestos' },
      { id: 'contratos', titulo: 'Los documentos impresos por duplicado',
        detalle: 'En la visita, los dos de implementación (contrato + anexo de trabajos). '
          + 'El de servicio, su Anexo I y el Anexo II (protección de datos) se firman después, al dar el visto bueno.' },
      { id: 'bot-probado', titulo: 'Bot probado de punta a punta desde tu móvil' },
    ],
  },
  {
    id: 'local',
    titulo: 'En el restaurante',
    detalle: 'La parte que solo se puede hacer allí.',
    pasos: [
      { id: 'chrome', titulo: 'Chrome instalado en su ordenador' },
      { id: 'acceso-directo', titulo: 'Acceso directo con --kiosk-printing',
        detalle: 'Sin eso sale el cuadro de imprimir en cada pedido y alguien tiene que aceptarlo.',
        critico: true },
      { id: 'impresora', titulo: 'Su impresora como predeterminada de Windows',
        detalle: 'Con el tamaño de papel correcto, normalmente rollo de 80 mm.' },
      { id: 'sesion-local', titulo: 'Su sesión abierta en el ordenador del local' },
      { id: 'ajustes-impresion', titulo: 'Impresión automática y dos tickets activados',
        detalle: 'Se guardan en ESE navegador, no en la cuenta: hay que activarlos allí.',
        critico: true },
      { id: 'prueba-domicilio', titulo: 'Prueba: pedido a domicilio, con sus dos tickets' },
      { id: 'prueba-recogida', titulo: 'Prueba: recogida y aviso al cliente al marcarlo listo' },
      { id: 'prueba-programado', titulo: 'Prueba: pedido programado',
        detalle: 'Debe imprimirse al llegar, con PROGRAMADO y la hora en grande.' },
      { id: 'prueba-menu', titulo: 'Prueba: un menú desde el enlace, si tienen' },
      { id: 'limpiar-pruebas', titulo: 'Pedidos de prueba borrados',
        detalle: 'Cuentan para su plan y saldrían en su historial desde el primer día.',
        critico: true },
    ],
  },
  {
    id: 'formacion',
    titulo: 'Enseñarles a usarlo',
    detalle: 'Diez minutos. Lo que van a tocar cada día y nada más.',
    pasos: [
      { id: 'form-tablero', titulo: 'El tablero y cómo avanzar un pedido' },
      { id: 'form-rojo', titulo: 'Qué significa el rojo parpadeante' },
      { id: 'form-espera', titulo: 'El botón de tiempo de espera' },
      { id: 'form-programados', titulo: 'El bloque de programados' },
      { id: 'form-editar', titulo: 'Dónde se cambian carta, horarios y menús' },
      { id: 'form-panel-abierto', titulo: 'Que dejen el panel abierto durante el servicio',
        detalle: 'Es lo que hace que los tickets salgan solos.' },
    ],
  },
  {
    id: 'papeles',
    titulo: 'Papeles y dinero',
    pasos: [
      { id: 'firma', titulo: 'Contratos firmados, dos copias' },
      { id: 'cobro-implantacion', titulo: 'Implementación cobrada',
        detalle: 'Se cobra al firmar, no después.' },
      { id: 'alergenos-validados', titulo: 'Alérgenos validados por ellos',
        detalle: 'Responsabilidad legal suya, y está escrito en el Anexo I.' },
      { id: 'aviso-alcohol', titulo: 'Explicado que el alcohol no puede ir por WhatsApp',
        detalle: 'No es limitación nuestra: es la política de Meta. Se sigue vendiendo por teléfono o al entregar.' },
      { id: 'fecha-inicio', titulo: 'Periodo de facturación arrancando el día de la puesta en marcha',
        detalle: 'plan_iniciado_en es el ancla del conteo de pedidos y del cobro.' },
    ],
  },
  {
    id: 'despues',
    titulo: 'Después',
    pasos: [
      { id: 'seguimiento', titulo: 'Preguntarles a los pocos días qué les chirría',
        detalle: 'Lo que se ve en dos días de uso real no se ve en ninguna demo.' },
      { id: 'huecos-carta', titulo: 'Huecos de la carta rellenados',
        detalle: 'Platos sin número o sin alérgenos que quedaron pendientes.' },
    ],
  },
];

// Todos los pasos en una lista, para contar.
export function todosLosPasos() {
  return FASES.flatMap((f) => f.pasos.map((p) => ({ ...p, fase: f.id })));
}

// Cuántos hechos sobre el total, y si queda algún paso crítico sin hacer.
export function avance(hechos) {
  const pasos = todosLosPasos();
  const marcados = new Set(hechos || []);
  const criticosPendientes = pasos.filter((p) => p.critico && !marcados.has(p.id));
  return {
    hechos: pasos.filter((p) => marcados.has(p.id)).length,
    total: pasos.length,
    criticosPendientes: criticosPendientes.length,
    completo: pasos.every((p) => marcados.has(p.id)),
  };
}

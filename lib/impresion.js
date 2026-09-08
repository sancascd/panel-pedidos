// El acceso directo de Chrome que imprime SIN cuadro de diálogo.
//
// Vive aquí porque se enseña en dos sitios (la ayuda del tablero y Ajustes) y
// tienen que decir exactamente lo mismo: es un comando que la gente copia y
// pega, y dos versiones distintas es garantía de que una se queda vieja.
//
// OJO con las rutas de Windows en JS: `String.raw` es obligatorio. Sin él,
// '\P' de "Program Files" no es un escape válido y la barra desaparece — ya
// pasó una vez y el comando que copiaban no servía.

export const CHROME_RUTA = String.raw`C:\Program Files\Google\Chrome\Application\chrome.exe`;

// El perfil aparte (--user-data-dir) no es un capricho:
// si Chrome ya está abierto por otra cosa, Windows NO arranca uno nuevo — le
// pide al que corre que abra una pestaña, y ese se arrancó sin --kiosk-printing.
// Parece que la opción no funciona cuando en realidad ni se ha aplicado.
// Con perfil propio se abre siempre un Chrome aparte y la opción se aplica.
export const PERFIL_DIR = String.raw`C:\ComandiChrome`;

export const COMANDO_KIOSK =
  '"' + CHROME_RUTA + '" --kiosk-printing --user-data-dir="' + PERFIL_DIR + '" https://comandi.es/pedidos';

export const PASOS_KIOSK = [
  {
    titulo: 'Crear el acceso directo',
    detalle: 'Clic derecho en el escritorio → Nuevo → Acceso directo, y pegar el comando de arriba. Ponle de nombre "Comandi".',
  },
  {
    titulo: 'Abrir el panel SIEMPRE desde ese acceso directo',
    detalle: 'Si se abre escribiendo la dirección en un Chrome normal, saldrá el cuadro de imprimir en cada pedido.',
  },
  {
    titulo: 'Iniciar sesión la primera vez',
    detalle: 'Abre un Chrome con perfil propio, así que pedirá la contraseña una vez. Después ya queda.',
  },
  {
    titulo: 'Poner la impresora de tickets como predeterminada en Windows',
    detalle: 'Chrome imprimirá en la predeterminada sin preguntar. Comprueba también el tamaño de papel.',
  },
  {
    titulo: 'Activar la impresión automática aquí, en ese ordenador',
    detalle: 'Los ajustes de impresión se guardan en el navegador del local, no en la cuenta: activarlos en otro equipo no sirve.',
  },
];

// Truco para probarlo sin gastar rollo: poner "Microsoft Print to PDF" como
// predeterminada, abrir el acceso directo y pulsar Ctrl+P. Si pide dónde
// guardar el PDF sin enseñar el cuadro de imprimir, funciona.
export const PRUEBA_KIOSK =
  'Para comprobarlo sin gastar papel: pon "Microsoft Print to PDF" como impresora predeterminada, ' +
  'abre el acceso directo y pulsa Ctrl+P. Si te pide dónde guardar el PDF sin enseñar el cuadro de ' +
  'imprimir, está funcionando. Luego vuelve a poner la impresora de tickets.';

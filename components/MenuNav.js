'use client';

import { createPortal } from 'react-dom';

// Menú de navegación compartido del panel (botón hamburguesa + desplegable).
// Se usa en todas las páginas para no duplicar la navegación. Resalta la
// sección activa y muestra "Admin" solo a superadmins.
//
// Uso:  <MenuNav />                 -> detecta admin por su cuenta
//       <MenuNav esAdmin={bool} />  -> si la página ya sabe si es admin

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { crearClienteSupabase } from '@/lib/supabase';
import {
  Menu, X, LayoutDashboard, UtensilsCrossed, Clock,
  Users, BarChart3, Star, Gauge, Settings, Shield, LogOut, ClipboardList,
  Briefcase, Presentation, FileText, BookOpen, Trophy, Receipt, FolderOpen, ChevronDown
} from 'lucide-react';
import { SECCIONES_ADMIN, rutaSeccionAdmin } from '@/lib/menuAdmin';

// Orden del menú del restaurante (Sandra, 2026-09-15):
//   Tablero · Carta y menús ▾ · Clientes · Analíticas · Reseñas (si están activadas)
//   ── Plan · Facturas · Ajustes (Horarios se abre desde Ajustes)
// `zona`: entre zonas distintas se pinta una barra. `grupo`: se juntan en una
// entrada que se despliega (GRUPOS).
const LINKS_NAV = [
  { href: '/pedidos',    icono: LayoutDashboard, label: 'Tablero',    zona: 1 },
  { href: '/carta',      icono: UtensilsCrossed, label: 'Carta',      zona: 1, grupo: 'carta' },
  { href: '/menus',      icono: ClipboardList,   label: 'Menús',      zona: 1, grupo: 'carta' },
  { href: '/clientes',   icono: Users,           label: 'Clientes',   zona: 1 },
  { href: '/analiticas', icono: BarChart3,       label: 'Analíticas', zona: 1 },
  // Solo si el restaurante tiene las reseñas activadas (vienen apagadas).
  { href: '/resenas',    icono: Star,            label: 'Reseñas',    zona: 1, soloResenas: true },
  { href: '/plan',       icono: Gauge,           label: 'Plan',       zona: 2 },
  { href: '/facturas',   icono: Receipt,         label: 'Facturas',   zona: 2 },
  { href: '/ajustes',    icono: Settings,        label: 'Ajustes',    zona: 2 },
  // La administradora ya no tiene enlace «Admin»: sus secciones (Dashboard,
  // Restaurantes, Planes, Comerciales, Facturación) van arriba del desplegable
  // en todas sus páginas (lib/menuAdmin). Decisión de Sandra, 2026-09-15.
  { href: '/comercial',  icono: Briefcase,       label: 'Mis contactos', soloComercial: true, zona: 3 },
  // Solo cifras del equipo (ranking, ciudades, avance): nunca los
  // restaurantes de otro comercial. Lo ven los comerciales y la administradora.
  { href: '/equipo',     icono: Trophy,          label: 'Cómo va el equipo', labelAdmin: 'Ranking', soloEquipo: true, zona: 3 },
  // Se abre en otra pestana: es un PDF para enseñar o mandar, no una pagina
  // del panel. Lo ven la administradora y los comerciales, nadie mas.
  { href: '/material/comandi-como-funciona.pdf', icono: FileText,
    label: 'Material para el cliente', soloEquipo: true, nuevaPestana: true, grupoAdmin: 'materiales', zona: 3 },
  // La guía completa para el comercial. Lleva consejos de venta que el
  // restaurante no debe leer: es para ellos, no para enseñar ni mandar.
  { href: '/material/guia-comercial.pdf', icono: BookOpen,
    label: 'Material para el comercial', soloEquipo: true, nuevaPestana: true, grupoAdmin: 'materiales', zona: 3 },
];

const GRUPOS = {
  carta:      { label: 'Carta y menús', icono: UtensilsCrossed },
  materiales: { label: 'Materiales',    icono: FolderOpen },
};

// `secciones` deja meter en el desplegable las pestanas de una pagina (lo usa
// /admin). Asi la cabecera no acumula dos filas de navegacion.
//   secciones: [{ id, label, icono, contador }]
export default function MenuNav({ esAdmin: esAdminProp, secciones, seccionActiva, onSeccion }) {
  const pathname = usePathname();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [esAdmin, setEsAdmin] = useState(esAdminProp === true);
  // Un superadmin sin restaurante vinculado (la cuenta de plataforma) no
  // tiene nada que hacer en Tablero, Carta, etc.: se le deja solo Admin.
  // Si algun dia se vincula a un restaurante para ayudarle, vuelve el menu
  // completo solo.
  const [sinRestaurante, setSinRestaurante] = useState(false);
  const [nombreRestaurante, setNombreRestaurante] = useState('');
  // Los comerciales tambien tienen desplegable: lo suyo, mas la demostracion.
  const [esComercial, setEsComercial] = useState(false);
  // El restaurante en el que se esta es el de demostraciones. Cambia el texto
  // de la barra y, sobre todo, POR DONDE se sale: salir_del_restaurante()
  // exige superadmin, asi que un comercial se quedaria dentro sin salida.
  const [esDemo, setEsDemo] = useState(false);
  // El numero al que tiene que escribir el cliente que estas visitando. Es lo
  // primero que hace falta en una demostracion, asi que va en la propia barra.
  const [numeroDemo, setNumeroDemo] = useState('');
  // Reseñas solo sale en el menú si el restaurante las tiene activadas.
  const [resenasActivas, setResenasActivas] = useState(false);
  // La barra de 'estas dentro de un restaurante' se pinta FUERA de la cabecera
  // (ver mas abajo el porque); para eso hace falta saber que ya hay document.
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  // En el ordenador que imprime, el tablero NO puede cerrarse: es quien saca
  // los tickets. Desde el tablero, el resto de pantallas se abren en otra
  // pestaña y el tablero sigue imprimiendo detras. (Antes, ir a Carta en esa
  // misma ventana dejaba de imprimir sin avisar.) El ajuste es por dispositivo.
  const [imprimeAqui, setImprimeAqui] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    try {
      const ajustes = JSON.parse(localStorage.getItem('comandi-impresion') || 'null');
      setImprimeAqui(!!(ajustes && ajustes.auto === true));
    } catch (e) { setImprimeAqui(false); }
  }, [abierto]);
  const protegerTablero = imprimeAqui && pathname === '/pedidos';

  // Si la página no nos dice si es admin, lo consultamos nosotros.
  useEffect(() => {
    if (esAdminProp !== undefined) {
      setEsAdmin(esAdminProp === true);
      return;
    }
    let activo = true;
    const supabase = crearClienteSupabase();
    supabase.rpc('soy_superadmin')
      .then(({ data }) => { if (activo) setEsAdmin(data === true); })
      .catch(() => {});
    return () => { activo = false; };
  }, [esAdminProp]);

  useEffect(() => {
    let activo = true;
    const supabase = crearClienteSupabase();
    supabase.rpc('soy_comercial')
      .then(({ data }) => { if (activo) setEsComercial(data === true); })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

  useEffect(() => {
    let activo = true;
    const supabase = crearClienteSupabase();
    supabase.rpc('mi_restaurante_id')
      .then(async ({ data }) => {
        if (!activo) return;
        setSinRestaurante(!data);
        if (!data) { setNombreRestaurante(''); setEsDemo(false); return; }
        const { data: rest } = await supabase
          .from('restaurantes').select('nombre, es_demo, whatsapp_numero, resenas_activas').eq('id', data).maybeSingle();
        if (!activo) return;
        setResenasActivas(rest?.resenas_activas === true);
        setNombreRestaurante(rest?.nombre || '');
        setEsDemo(rest?.es_demo === true);
        setNumeroDemo(rest?.es_demo ? (rest.whatsapp_numero || '') : '');
      })
      .catch(() => {});
    return () => { activo = false; };
  }, []);

  // Solo aparece cuando alguien SIN restaurante propio esta dentro del panel
  // de uno: la superadmin (entro desde /admin) o un comercial (entro en la
  // demostracion). Deshace el vinculo temporal.
  const dentroDeUnRestaurante = (esAdmin || esComercial) && !sinRestaurante;
  const puedeDemostrar = esAdmin || esComercial;

  // La cuenta de plataforma y la de un comercial no tienen restaurante propio:
  // sin vinculo no hay tablero ni carta que abrir, solo lo suyo. En cuanto
  // entran en uno (un cliente o la demo) les vuelve el menu completo.
  const soloLoSuyo = puedeDemostrar && sinRestaurante;
  const linksVisibles = LINKS_NAV.filter(l => {
    if (l.soloAdmin && !esAdmin) return false;
    if (l.soloComercial && !esComercial) return false;
    if (l.soloEquipo && !puedeDemostrar) return false;
    if (soloLoSuyo && !l.soloAdmin && !l.soloComercial && !l.soloEquipo) return false;
    if (l.soloResenas && !resenasActivas) return false;
    return true;
  });

  // Desplegable de la administradora (fuera de un restaurante), igual en todas
  // sus páginas: sus secciones arriba · Demostración · Ranking y Materiales.
  // Si la página ya trae sus `secciones` (/admin, /admin/facturacion), mandan esas.
  const menuAdmin = esAdmin && soloLoSuyo;
  const seccionesMenu = secciones && secciones.length
    ? secciones
    : (menuAdmin ? SECCIONES_ADMIN.map(s => ({ ...s, href: rutaSeccionAdmin(s.id) })) : null);
  // Grupo de cada enlace: `grupo` para todos; `grupoAdmin` solo en el menú de
  // la administradora (los materiales de los comerciales siguen sueltos).
  const grupoDe = (l) => l.grupo || (menuAdmin ? l.grupoAdmin : null);
  // Un grupo empieza abierto si se está en una de sus páginas.
  const [gruposAbiertos, setGruposAbiertos] = useState({});
  const grupoAbierto = (g) => gruposAbiertos[g] ?? linksVisibles.some(l => grupoDe(l) === g && l.href === pathname);

  // Los enlaces del desplegable: una barra al cambiar de zona y los grupos
  // («Carta y menús», «Materiales») como una entrada que se despliega.
  function pintarEnlaces() {
    const piezas = [];
    const gruposPintados = new Set();
    let zonaAnterior = null;

    const enlace = (l, dentro) => {
      const otraPestana = l.nuevaPestana || (protegerTablero && l.href !== '/pedidos');
      const Icono = l.icono;
      return (
        <a
          key={l.href}
          href={l.href}
          role="menuitem"
          target={otraPestana ? '_blank' : undefined}
          rel={otraPestana ? 'noopener noreferrer' : undefined}
          onClick={() => setAbierto(false)}
          className={`flex items-center gap-2.5 ${dentro ? 'pl-9 pr-3 py-2' : 'px-3 py-2.5'} rounded-lg text-sm font-medium transition-colors ${
            pathname === l.href
              ? 'bg-accent/10 text-accent'
              : 'text-text-muted hover:text-text hover:bg-surface-2'
          }`}
        >
          <Icono className="w-4 h-4 flex-shrink-0" />
          {(menuAdmin && l.labelAdmin) || l.label}
        </a>
      );
    };

    for (const l of linksVisibles) {
      const g = grupoDe(l);
      if (g && gruposPintados.has(g)) continue;
      if (zonaAnterior !== null && l.zona !== zonaAnterior) {
        piezas.push(<div key={'barra-' + l.href} className="my-1.5 border-t border-border" />);
      }
      zonaAnterior = l.zona;

      if (!g) { piezas.push(enlace(l, false)); continue; }

      gruposPintados.add(g);
      const { label, icono: IconoGrupo } = GRUPOS[g];
      const abiertoGrupo = grupoAbierto(g);
      const hijos = linksVisibles.filter(x => grupoDe(x) === g);
      const dentroDelGrupo = hijos.some(x => x.href === pathname);
      piezas.push(
        <button
          key={'grupo-' + g}
          onClick={() => setGruposAbiertos(prev => ({ ...prev, [g]: !abiertoGrupo }))}
          role="menuitem"
          aria-expanded={abiertoGrupo}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            dentroDelGrupo && !abiertoGrupo ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text hover:bg-surface-2'
          }`}
        >
          <IconoGrupo className="w-4 h-4 flex-shrink-0" />
          {label}
          <ChevronDown className={`w-4 h-4 ml-auto transition-transform ${abiertoGrupo ? 'rotate-180' : ''}`} />
        </button>
      );
      if (abiertoGrupo) hijos.forEach(h => piezas.push(enlace(h, true)));
    }
    return piezas;
  }

  async function salirDelPanel() {
    const supabase = crearClienteSupabase();
    // salir_del_restaurante() exige superadmin; salir_de_la_demo() no, porque
    // solo puede deshacer vinculos con restaurantes de demostracion.
    const { error } = await supabase.rpc(esDemo ? 'salir_de_la_demo' : 'salir_del_restaurante');
    if (error) { alert('No se pudo salir: ' + error.message); return; }
    window.location.href = esAdmin ? '/admin' : '/comercial';
  }

  async function entrarEnDemo() {
    const supabase = crearClienteSupabase();
    const { error } = await supabase.rpc('entrar_en_demo');
    if (error) { alert('No se pudo entrar en la demostracion: ' + error.message); return; }
    window.location.href = '/pedidos';
  }

  return (
    <>
      {/* Barra fija mientras el superadmin esta dentro del panel de un
          restaurante. Estaba solo en el menu desplegable y se olvidaba:
          volvias a entrar al dia siguiente y seguias dentro sin darte cuenta. */}
      {/* BUG que escondia la cabecera entera: esta barra es `fixed`, pero vivia
          dentro de la cabecera, que lleva `backdrop-blur`. Un filtro de fondo
          crea un marco de referencia propio, asi que el `fixed` dejaba de
          posicionarse respecto a la ventana y lo hacia respecto a la cabecera:
          se pintaba justo encima, tapando el logo, los botones y este mismo
          menu. Solo se veia siendo superadmin dentro de un restaurante, que es
          cuando aparece la barra. Se saca del arbol con un portal. */}
      {montado && dentroDeUnRestaurante && createPortal(
        <div className="fixed bottom-0 left-0 right-0 z-[60] no-imprimir bg-amber-500 text-black shadow-lift">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium min-w-0">
              {esDemo ? (
                <>Estas en la <strong>demostracion</strong>
                  {numeroDemo ? <> — que escriban al <strong>{numeroDemo}</strong></> : null}
                </>
              ) : (
                <>Estas viendo el panel de{' '}
                <strong>{nombreRestaurante || 'un restaurante'}</strong> como administradora</>
              )}
            </p>
            <button
              onClick={salirDelPanel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/85 text-white text-sm font-semibold hover:bg-black transition-colors flex-shrink-0"
            >
              <LogOut className="w-4 h-4" />
              Salir
            </button>
          </div>
        </div>,
        document.body
      )}

    <div className="relative">
      <button
        onClick={() => setAbierto(v => !v)}
        className="btn-ghost p-2.5"
        aria-haspopup="menu"
        aria-expanded={abierto}
        title="Menú de navegación"
      >
        {abierto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {abierto && (
        <>
          {/* Capa para cerrar al pulsar fuera */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setAbierto(false)}
            aria-hidden
          />
          <div className="absolute right-0 mt-2 w-56 z-50 card shadow-lift p-1.5 animate-fade-in" role="menu">
            {seccionesMenu && seccionesMenu.length > 0 && (
              <>
                {seccionesMenu.map(({ id, label, icono: Icono, contador, href }) => (
                  <button
                    key={id}
                    onClick={() => {
                      setAbierto(false);
                      if (href) { window.location.href = href; return; }
                      onSeccion(id);
                    }}
                    role="menuitem"
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      seccionActiva === id
                        ? 'bg-accent/10 text-accent'
                        : 'text-text-muted hover:text-text hover:bg-surface-2'
                    }`}
                  >
                    <Icono className="w-4 h-4 flex-shrink-0" />
                    {label}
                    {contador ? (
                      <span className="ml-auto tabular-nums text-xs px-1.5 py-0.5 rounded-md bg-surface-2 text-text-muted">
                        {contador}
                      </span>
                    ) : null}
                  </button>
                ))}
                <div className="my-1.5 border-t border-border" />
              </>
            )}
            {dentroDeUnRestaurante && (
              <>
                <button
                  onClick={() => { setAbierto(false); salirDelPanel(); }}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  {esDemo ? 'Salir de la demostracion' : 'Salir del panel'}
                </button>
                <div className="my-1.5 border-t border-border" />
              </>
            )}
            {puedeDemostrar && !esDemo && (
              <>
                <button
                  onClick={() => { setAbierto(false); entrarEnDemo(); }}
                  role="menuitem"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-text-muted hover:text-text hover:bg-surface-2 transition-colors"
                >
                  <Presentation className="w-4 h-4 flex-shrink-0" />
                  Demostración
                </button>
                <div className="my-1.5 border-t border-border" />
              </>
            )}
            {pintarEnlaces()}
          </div>
        </>
      )}
    </div>
    </>
  );
}

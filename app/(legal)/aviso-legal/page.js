export const metadata = {
  title: 'Aviso legal — Comandi',
  description: 'Información legal del titular del sitio web Comandi.',
};

export default function AvisoLegal() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-2">Aviso legal</h1>
      <p className="text-sm text-text-muted mb-10">Última actualización: 20 de mayo de 2026</p>

      <div className="space-y-8 text-sm text-text leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-text mb-3">1. Información del titular</h2>
          <p className="text-text-muted">
            En cumplimiento de la Ley 34/2002, de 11 de julio, de servicios de la sociedad de la información
            y de comercio electrónico (LSSI-CE), se informa que el titular de este sitio web es:
          </p>
          <ul className="mt-3 space-y-1 text-text-muted">
            <li><strong className="text-text">Titular:</strong> SCD TECH SL</li>
            <li><strong className="text-text">NIF/CIF:</strong> [NIF]</li>
            <li><strong className="text-text">Domicilio:</strong> [DIRECCIÓN FISCAL]</li>
            <li><strong className="text-text">Email de contacto:</strong> info@comandi.es</li>
            <li><strong className="text-text">Sitio web:</strong> https://comandi.es</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">2. Objeto y aceptación</h2>
          <p className="text-text-muted">
            Este aviso legal regula el uso del sitio web de Comandi, una plataforma de software como
            servicio (SaaS) para que restaurantes españoles gestionen pedidos a través de WhatsApp con
            ayuda de inteligencia artificial.
          </p>
          <p className="text-text-muted mt-3">
            El acceso al sitio implica la aceptación de las condiciones aquí descritas. Si no estás de
            acuerdo con alguna parte, te pedimos que no utilices el sitio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">3. Condiciones de uso</h2>
          <p className="text-text-muted">
            El usuario se compromete a hacer un uso adecuado de los contenidos y servicios ofrecidos
            y a no emplearlos para fines ilícitos, contrarios a la buena fe, que dañen los derechos e
            intereses de terceros o que perjudiquen el funcionamiento normal del sitio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">4. Propiedad intelectual e industrial</h2>
          <p className="text-text-muted">
            Todos los contenidos del sitio (textos, imágenes, código, logotipos, diseños) son
            propiedad del titular o de terceros que han autorizado su uso. Queda prohibida la
            reproducción, distribución o modificación de los contenidos sin autorización expresa.
          </p>
          <p className="text-text-muted mt-3">
            El nombre comercial "Comandi" y su logotipo son marcas propiedad del titular.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">5. Responsabilidad</h2>
          <p className="text-text-muted">
            El titular hace todo lo razonablemente posible para que la información del sitio sea
            correcta, actualizada y útil, pero no garantiza la ausencia de errores ni la
            disponibilidad continua del servicio. No se hace responsable de daños derivados del uso
            del sitio o de la imposibilidad de utilizarlo.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">6. Enlaces a terceros</h2>
          <p className="text-text-muted">
            El sitio puede contener enlaces a páginas web de terceros (por ejemplo, WhatsApp). El
            titular no se hace responsable del contenido ni de las políticas de privacidad de dichos
            sitios externos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">7. Modificaciones</h2>
          <p className="text-text-muted">
            El titular se reserva el derecho de modificar en cualquier momento el contenido del
            sitio y las condiciones aquí establecidas. Las modificaciones tendrán efecto desde su
            publicación.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">8. Legislación aplicable y jurisdicción</h2>
          <p className="text-text-muted">
            Este aviso legal se rige por la legislación española. Para cualquier controversia, las
            partes se someten a los Juzgados y Tribunales de Córdoba, salvo que la ley imponga otro
            fuero.
          </p>
        </section>
      </div>
    </main>
  );
}

export const metadata = {
  title: 'Política de privacidad — Comandi',
  description: 'Información sobre el tratamiento de datos personales en Comandi.',
};

export default function Privacidad() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-2">Política de privacidad</h1>
      <p className="text-sm text-text-muted mb-10">Última actualización: 20 de mayo de 2026</p>

      <div className="space-y-8 text-sm text-text leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-text mb-3">1. Responsable del tratamiento</h2>
          <p className="text-text-muted">
            En cumplimiento del Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 de
            Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), se
            informa de la siguiente identificación del responsable:
          </p>
          <ul className="mt-3 space-y-1 text-text-muted">
            <li><strong className="text-text">Responsable:</strong> [NOMBRE COMPLETO]</li>
            <li><strong className="text-text">NIF/CIF:</strong> [NIF]</li>
            <li><strong className="text-text">Domicilio:</strong> [DIRECCIÓN FISCAL]</li>
            <li><strong className="text-text">Email:</strong> [EMAIL]</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">2. Datos que recogemos y finalidad</h2>
          <p className="text-text-muted">Comandi trata datos personales en dos contextos:</p>

          <div className="mt-4 space-y-4">
            <div>
              <h3 className="font-medium text-text mb-1">A) Datos del titular del restaurante (usuario del panel)</h3>
              <ul className="list-disc pl-5 text-text-muted space-y-1">
                <li><strong className="text-text">Datos identificativos:</strong> nombre, email, contraseña, datos del restaurante (nombre, dirección, teléfono).</li>
                <li><strong className="text-text">Finalidad:</strong> prestar el servicio contratado, gestionar la cuenta, enviar comunicaciones operativas.</li>
                <li><strong className="text-text">Base legal:</strong> ejecución del contrato (art. 6.1.b RGPD).</li>
                <li><strong className="text-text">Conservación:</strong> mientras dure la relación contractual y los plazos legales aplicables tras su finalización.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-medium text-text mb-1">B) Datos de los clientes finales de los restaurantes</h3>
              <p className="text-text-muted">
                Cuando un cliente realiza un pedido a un restaurante a través del bot de WhatsApp de
                Comandi, se procesan los siguientes datos:
              </p>
              <ul className="list-disc pl-5 text-text-muted space-y-1 mt-2">
                <li>Número de teléfono de WhatsApp</li>
                <li>Nombre proporcionado por el cliente</li>
                <li>Dirección de entrega (si aplica)</li>
                <li>Contenido del pedido y método de pago elegido</li>
                <li>Reseñas y comentarios tras la entrega (si las facilita)</li>
              </ul>
              <p className="text-text-muted mt-3">
                En este contexto, el <strong className="text-text">restaurante</strong> actúa como
                responsable del tratamiento (decide qué datos recoger y para qué), y
                <strong className="text-text"> Comandi</strong> actúa como encargado del tratamiento
                conforme al artículo 28 RGPD: procesa los datos en nombre del restaurante únicamente
                para prestar el servicio.
              </p>
              <ul className="list-disc pl-5 text-text-muted space-y-1 mt-3">
                <li><strong className="text-text">Finalidad:</strong> gestionar el pedido (interpretarlo, mostrarlo al restaurante, avisar al cliente de cambios y solicitar reseña).</li>
                <li><strong className="text-text">Base legal:</strong> ejecución de un contrato entre el cliente y el restaurante (art. 6.1.b RGPD) o consentimiento del cliente al iniciar la conversación.</li>
                <li><strong className="text-text">Conservación:</strong> los datos de pedido se conservan durante la relación con el restaurante y por los plazos fiscales/contables legalmente exigibles. Las conversaciones inactivas se borran transcurridos 30 minutos.</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">3. Destinatarios y encargados del tratamiento</h2>
          <p className="text-text-muted">
            Para prestar el servicio, Comandi utiliza los siguientes proveedores tecnológicos que
            actúan como subencargados del tratamiento, todos ellos con contratos y garantías
            adecuadas conforme al RGPD:
          </p>
          <ul className="list-disc pl-5 text-text-muted space-y-1 mt-3">
            <li><strong className="text-text">Supabase</strong> (Estados Unidos / Unión Europea) — alojamiento de base de datos.</li>
            <li><strong className="text-text">Anthropic, PBC</strong> (Estados Unidos) — procesamiento por IA de los mensajes para entender pedidos.</li>
            <li><strong className="text-text">Twilio Inc.</strong> (Estados Unidos / Unión Europea) — pasarela de WhatsApp.</li>
            <li><strong className="text-text">Vercel Inc.</strong> (Estados Unidos / Unión Europea) — alojamiento del panel web.</li>
            <li><strong className="text-text">Railway Corp.</strong> (Estados Unidos) — alojamiento del bot.</li>
          </ul>
          <p className="text-text-muted mt-3">
            En los casos en que se realicen transferencias internacionales fuera del Espacio
            Económico Europeo, se utilizan Cláusulas Contractuales Tipo aprobadas por la Comisión
            Europea u otros mecanismos válidos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">4. Cesión a terceros</h2>
          <p className="text-text-muted">
            No cedemos tus datos personales a terceros con fines comerciales. Los datos de los
            clientes finales son visibles únicamente para el restaurante propietario del pedido
            (mediante políticas de Row Level Security a nivel de base de datos).
          </p>
          <p className="text-text-muted mt-3">
            Solo se compartirán datos con autoridades cuando exista obligación legal.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">5. Derechos del interesado</h2>
          <p className="text-text-muted">
            Tienes derecho a:
          </p>
          <ul className="list-disc pl-5 text-text-muted space-y-1 mt-2">
            <li><strong className="text-text">Acceso:</strong> saber qué datos tuyos tratamos.</li>
            <li><strong className="text-text">Rectificación:</strong> corregir datos inexactos.</li>
            <li><strong className="text-text">Supresión:</strong> solicitar el borrado de tus datos cuando ya no sean necesarios.</li>
            <li><strong className="text-text">Oposición:</strong> oponerte al tratamiento en determinadas circunstancias.</li>
            <li><strong className="text-text">Limitación:</strong> solicitar la limitación del tratamiento.</li>
            <li><strong className="text-text">Portabilidad:</strong> recibir tus datos en formato estructurado.</li>
            <li><strong className="text-text">Revocación del consentimiento</strong> cuando el tratamiento se base en él.</li>
          </ul>
          <p className="text-text-muted mt-3">
            Para ejercer cualquiera de estos derechos, escribe a <strong className="text-text">[EMAIL]</strong>
            indicando el derecho que deseas ejercer. Responderemos en el plazo máximo de un mes.
          </p>
          <p className="text-text-muted mt-3">
            Si consideras que tus derechos no han sido atendidos correctamente, puedes presentar una
            reclamación ante la Agencia Española de Protección de Datos (AEPD) en{' '}
            <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="underline">
              www.aepd.es
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">6. Medidas de seguridad</h2>
          <p className="text-text-muted">
            Aplicamos medidas técnicas y organizativas apropiadas para garantizar la seguridad de
            los datos personales: cifrado en tránsito (HTTPS), aislamiento de datos entre
            restaurantes mediante Row Level Security, autenticación obligatoria para acceder al
            panel, y backups periódicos de la base de datos.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">7. Cookies</h2>
          <p className="text-text-muted">
            Este sitio web utiliza únicamente cookies técnicas estrictamente necesarias para el
            funcionamiento (mantener la sesión de los usuarios autenticados y recordar la
            preferencia de modo claro/oscuro). No se utilizan cookies de análisis ni de publicidad
            que requieran consentimiento.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text mb-3">8. Modificaciones</h2>
          <p className="text-text-muted">
            Esta política puede modificarse para adaptarla a cambios legislativos o mejoras del
            servicio. Cuando ocurra, se publicará la nueva versión con su fecha de actualización
            correspondiente.
          </p>
        </section>
      </div>
    </main>
  );
}

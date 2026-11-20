import PublicLayout from '../components/public/PublicLayout';
import {
  APP_NAME,
  APP_URL,
  PRIVACY_CONTACT_EMAIL,
  PRIVACY_LAST_UPDATED,
  PRIVACY_RESPONSIBLE,
} from '../lib/legal';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
      <div className="mt-3 space-y-3 leading-7 text-gray-700">{children}</div>
    </section>
  );
}

const mail = (
  <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="font-medium text-blue-700 hover:underline">
    {PRIVACY_CONTACT_EMAIL}
  </a>
);

/**
 * Política de privacidad pública en `/privacidad`.
 * Describe lo que la aplicación hace hoy: si cambia lo que se recoge o con quién
 * se comparte, actualiza este texto y PRIVACY_LAST_UPDATED en lib/legal.ts.
 */
export default function PrivacyPage() {
  return (
    <PublicLayout title={`Política de privacidad — ${APP_NAME}`}>
      <article className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Política de privacidad</h1>
        <p className="mt-2 text-sm text-gray-500">Última actualización: {PRIVACY_LAST_UPDATED}</p>

        <p className="mt-8 leading-7 text-gray-700">
          Esta política explica qué datos recoge {APP_NAME} ({APP_URL}), para qué los usa, con
          quién los comparte y qué derechos tienes sobre ellos. El responsable del tratamiento es{' '}
          {PRIVACY_RESPONSIBLE}. Para cualquier consulta escríbenos a {mail}.
        </p>

        <Section title="1. Datos que recogemos">
          <p>
            <strong>Datos de tu cuenta de Google.</strong> Cuando inicias sesión con Google
            recibimos tu nombre, tu dirección de correo electrónico (verificada por Google) y un
            identificador único de tu cuenta. Solo pedimos los permisos básicos{' '}
            <code className="rounded bg-gray-100 px-1 text-sm">openid</code>,{' '}
            <code className="rounded bg-gray-100 px-1 text-sm">email</code> y{' '}
            <code className="rounded bg-gray-100 px-1 text-sm">profile</code>. No accedemos a tu
            Gmail, tu Drive, tus contactos ni a ningún otro servicio de Google, y no guardamos tu
            contraseña ni los tokens de acceso de Google.
          </p>
          <p>
            <strong>Contenido que creas.</strong> Los espacios de trabajo, proyectos, listas,
            tareas (con sus pasos, categorías y fechas), comentarios, enlaces e invitaciones que añades a la
            aplicación, y la lista de miembros de cada espacio y sus roles. De los archivos de Google Drive
            que vinculas a una tarea solo se guarda el nombre y el enlace: el archivo sigue en tu Drive y
            DoTask no lo copia ni lo almacena. Si activas las notificaciones, se guarda la dirección de
            entrega del navegador o celular que las recibe.
          </p>
          <p>
            <strong>Datos técnicos.</strong> Para proteger el servicio, nuestro servidor procesa la
            dirección IP y los datos básicos de cada petición (fecha, ruta y navegador). Se usan
            para limitar intentos abusivos y diagnosticar errores, y se conservan solo en los
            registros del servidor durante un tiempo limitado.
          </p>
        </Section>

        <Section title="2. Para qué los usamos">
          <ul className="list-disc space-y-2 pl-6">
            <li>Identificarte e iniciar tu sesión.</li>
            <li>Mostrarte tu contenido y el de los espacios de los que eres miembro.</li>
            <li>
              Mostrar tu nombre y tu correo a los demás miembros de tus espacios, para que puedan
              asignarte tareas y ver quién escribió cada comentario.
            </li>
            <li>Mantener la seguridad del servicio y corregir fallos.</li>
          </ul>
          <p>
            No usamos tus datos para publicidad, no creamos perfiles comerciales y no vendemos ni
            alquilamos tu información.
          </p>
        </Section>

        <Section title="3. Uso de los datos de Google">
          <p>
            El uso y la transferencia a cualquier otra aplicación de la información recibida de las
            API de Google se ajustan a la{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 hover:underline"
            >
              Política de datos de usuario de los servicios de API de Google
            </a>
            , incluidos los requisitos de uso limitado. Los datos de Google solo se usan para
            identificarte dentro de {APP_NAME}.
          </p>
        </Section>

        <Section title="4. Cookies">
          <p>
            Usamos únicamente cookies técnicas, necesarias para que la aplicación funcione. No
            usamos cookies de análisis ni de publicidad.
          </p>
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <code className="rounded bg-gray-100 px-1 text-sm">dotask_session</code>: mantiene tu
              sesión iniciada durante 7 días. Va firmada para que nadie pueda falsificarla.
            </li>
            <li>
              <code className="rounded bg-gray-100 px-1 text-sm">dotask_oauth</code>: protege el
              proceso de inicio de sesión con Google y se borra en un máximo de 10 minutos.
            </li>
          </ul>
          <p>
            La aplicación también puede guardar archivos en tu navegador para funcionar sin conexión
            y cargar más rápido. Las apps de Windows y Android usan estas mismas cookies: la de
            Windows las guarda en tu equipo y la de Android, en Google Chrome.
          </p>
        </Section>

        <Section title="5. Con quién compartimos los datos">
          <ul className="list-disc space-y-2 pl-6">
            <li>
              <strong>Miembros de tus espacios:</strong> ven tu nombre, tu correo y el contenido que
              publicas en ese espacio.
            </li>
            <li>
              <strong>Google:</strong> interviene en el inicio de sesión según su propia{' '}
              <a
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:underline"
              >
                política de privacidad
              </a>
              .
            </li>
            <li>
              <strong>Proveedor de alojamiento:</strong> los datos se guardan en los servidores que
              contratamos para alojar la aplicación, que los tratan solo por nuestra cuenta.
            </li>
            <li>
              <strong>GitHub:</strong> aloja los instaladores de las apps de Windows y Android. Al
              abrir la página de inicio, tu navegador consulta a GitHub qué versiones hay
              disponibles, y al descargar una app GitHub recibe tu dirección IP según su{' '}
              <a
                href="https://docs.github.com/es/site-policy/privacy-policies/github-general-privacy-statement"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-700 hover:underline"
              >
                declaración de privacidad
              </a>
              .
            </li>
            <li>
              <strong>Autoridades:</strong> solo cuando la ley nos obligue.
            </li>
          </ul>
          <p>
            Si en el futuro añadimos integraciones con otros servicios, solo se activarán si tú lo
            decides y actualizaremos esta política antes.
          </p>
        </Section>

        <Section title="6. Cuánto tiempo los conservamos">
          <p>
            Conservamos tus datos mientras tengas una cuenta. Si nos pides eliminarla, borraremos tu
            cuenta y el contenido asociado en un plazo máximo de 30 días. Las copias de seguridad se
            sobrescriben con el tiempo. Los comentarios que dejaste en espacios compartidos pueden
            eliminarse o quedar anonimizados.
          </p>
        </Section>

        <Section title="7. Seguridad">
          <p>
            Todo el tráfico va cifrado con HTTPS, la sesión usa cookies firmadas y protegidas contra
            el acceso desde JavaScript, y cada petición comprueba que tienes acceso al espacio de
            trabajo correspondiente. Ningún sistema es infalible: si detectamos un incidente que
            afecte a tus datos, te avisaremos.
          </p>
        </Section>

        <Section title="8. Tus derechos">
          <p>
            Puedes conocer, actualizar, rectificar y eliminar tus datos, revocar tu autorización y
            pedir una copia de tu información, conforme a la ley aplicable, incluida la Ley 1581 de
            2012 de protección de datos personales de Colombia. Para ejercerlos escríbenos a {mail}.
            Responderemos en un plazo máximo de 15 días hábiles.
          </p>
          <p>
            También puedes retirar el acceso de {APP_NAME} a tu cuenta de Google en cualquier
            momento desde{' '}
            <a
              href="https://myaccount.google.com/connections"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 hover:underline"
            >
              myaccount.google.com/connections
            </a>
            .
          </p>
        </Section>

        <Section title="9. Menores de edad">
          <p>
            {APP_NAME} no está dirigida a menores de 14 años y no recogemos a sabiendas datos de
            ellos. Si crees que un menor nos ha dado sus datos, escríbenos y los eliminaremos.
          </p>
        </Section>

        <Section title="10. Cambios en esta política">
          <p>
            Si cambiamos esta política publicaremos la nueva versión en esta página con su fecha de
            actualización. Si el cambio es importante, te avisaremos dentro de la aplicación.
          </p>
        </Section>
      </article>
    </PublicLayout>
  );
}

import { Link } from 'react-router-dom';
import PublicLayout from '../components/public/PublicLayout';
import DownloadSection from '../components/public/DownloadSection';
import { useAuth } from '../hooks/useAuth';
import { APP_NAME } from '../lib/legal';

const FEATURES = [
  {
    title: 'Espacios de trabajo',
    body: 'Separa lo personal del trabajo. Cada espacio tiene sus propios proyectos, miembros y tareas.',
  },
  {
    title: 'Proyectos, hitos y listas',
    body: 'Organiza el trabajo en proyectos con hitos y listas de tareas, con prioridad, fechas y subtareas.',
  },
  {
    title: 'Trabajo en equipo',
    body: 'Invita a otras personas con un código, asígnales tareas y conversa en los comentarios de cada tarea.',
  },
  {
    title: 'En cualquier dispositivo',
    body: 'Funciona en el navegador del computador y del celular, y se puede instalar como aplicación.',
  },
];

const STEPS = [
  'Entra con tu cuenta de Google. No necesitas crear otra contraseña.',
  'Crea tu primer espacio de trabajo o únete a uno con un código de invitación.',
  'Añade tareas a tus listas y márcalas como completadas a medida que avanzas.',
];

/** Página pública de inicio: se muestra en `/` a quien no ha iniciado sesión. */
export default function LandingPage() {
  const { login } = useAuth();

  return (
    <PublicLayout title={`${APP_NAME} — Gestión de tareas personal y en equipo`}>
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-20 text-center sm:pt-28">
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Tus tareas y las de tu equipo, en un solo lugar
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
          {APP_NAME} te ayuda a organizar proyectos en hitos y listas, repartir el trabajo y
          saber en todo momento qué falta por hacer.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <button
            onClick={login}
            className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 sm:w-auto"
          >
            Continuar con Google
          </button>
          <a
            href="#descargas"
            className="w-full rounded-lg px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:w-auto"
          >
            Descargar la app
          </a>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title}>
              <h2 className="text-base font-semibold text-gray-900">{feature.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <DownloadSection />

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Cómo empezar</h2>
        <ol className="mt-6 space-y-4">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                {index + 1}
              </span>
              <span className="pt-0.5 text-gray-700">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm text-gray-500">
          Solo usamos tu nombre y tu correo de Google para identificarte. No vendemos tus datos
          ni mostramos publicidad. Lee la{' '}
          <Link to="/privacidad" className="font-medium text-blue-700 hover:underline">
            política de privacidad
          </Link>
          .
        </p>
      </section>
    </PublicLayout>
  );
}

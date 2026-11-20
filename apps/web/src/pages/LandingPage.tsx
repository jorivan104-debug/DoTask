import { useState } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../components/public/PublicLayout';
import DownloadSection from '../components/public/DownloadSection';
import BrandMark from '../components/brand/BrandMark';
import Sparkle from '../components/brand/Sparkle';
import TaskRow, { type TaskRowData } from '../components/tasks/TaskRow';
import { DateIcon, MyTasksIcon, ProjectIcon, ReminderIcon } from '../components/icons';
import { useAuth } from '../hooks/useAuth';
import { APP_NAME } from '../lib/legal';

/** Fecha relativa a hoy a una hora fija, para que el ejemplo se lea natural. */
const dayAt = (days: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

/** Tareas de ejemplo con todos los estados de la guía: el visitante puede marcarlas. */
const DEMO_TASKS: TaskRowData[] = [
  { id: 'd1', title: 'Enviar la propuesta al cliente', status: 'pending', dueAt: dayAt(-1, 17), context: 'Ventas' },
  { id: 'd2', title: 'Revisar el diseño de la portada', status: 'pending', dueAt: dayAt(1, 10), context: 'Sitio web' },
  { id: 'd3', title: 'Preparar la reunión del lunes', status: 'in_progress', context: 'Equipo' },
  { id: 'd4', title: 'Comprar regalo de cumpleaños', status: 'pending', dueAt: dayAt(5, 0), context: 'Personal' },
  { id: 'd5', title: 'Pagar la factura de internet', status: 'completed', context: 'Hogar' },
];

const FEATURES = [
  {
    icon: MyTasksIcon,
    title: 'Mis tareas',
    body: 'Todo lo que tienes pendiente, con su estado a la vista: en progreso, por vencer o vencida.',
  },
  {
    icon: ProjectIcon,
    title: 'Proyectos',
    body: 'Organiza el trabajo en proyectos con hitos y listas, y compártelos con tu equipo.',
  },
  {
    icon: DateIcon,
    title: 'Fechas',
    body: 'Pon fecha a lo importante y DoTask te muestra qué está por vencer antes de que se te pase.',
  },
  {
    icon: ReminderIcon,
    title: 'Recordatorios',
    body: 'Avisos en el celular y en el computador. Muy pronto.',
  },
];

const STEPS = [
  'Entra con tu cuenta de Google. No necesitas crear otra contraseña.',
  'Crea tu primer espacio de trabajo o únete a uno con un código de invitación.',
  'Añade tareas y márcalas como hechas. Cada chulito cuenta.',
];

function DemoTaskList() {
  const [tasks, setTasks] = useState(DEMO_TASKS);
  const done = tasks.filter((t) => t.status === 'completed').length;

  const toggle = (task: TaskRowData) =>
    setTasks((all) =>
      all.map((t) =>
        t.id === task.id ? { ...t, status: t.status === 'completed' ? 'pending' : 'completed' } : t,
      ),
    );

  return (
    <div className="card relative w-full max-w-md p-3 text-left shadow-[var(--shadow-lift)] sm:p-4">
      <Sparkle size={34} className="absolute -right-3 -top-4 animate-twinkle" />
      <div className="flex items-center justify-between px-3 pb-3 pt-1">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
            <MyTasksIcon size={18} />
          </span>
          <p className="font-bold text-ink">Mis tareas</p>
        </div>
        <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">
          {done} de {tasks.length} hechas
        </span>
      </div>
      <ul className="space-y-0.5">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={toggle} />
        ))}
      </ul>
      <p className="px-3 pt-3 text-xs text-muted">Pruébalo: marca una tarea.</p>
    </div>
  );
}

/** Página pública de inicio: se muestra en `/` a quien no ha iniciado sesión. */
export default function LandingPage() {
  const { login } = useAuth();

  return (
    <PublicLayout title={`${APP_NAME} — Gestión de tareas personal y en equipo`}>
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-brand/10 blur-3xl"
          aria-hidden="true"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-6 pb-20 pt-14 sm:pt-20 lg:grid-cols-[1.05fr_1fr]">
          <div className="text-center lg:text-left">
            <BrandMark
              size={64}
              animated
              className="mx-auto mb-6 drop-shadow-[0_10px_24px_rgb(36_87_230/0.3)] lg:mx-0"
            />
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-ink sm:text-5xl">
              Marca la tarea.
              <br />
              <span className="text-brand">Siente el avance.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted lg:mx-0">
              {APP_NAME} organiza tus proyectos y los de tu equipo en hitos y listas, para que siempre sepas
              qué sigue y disfrutes cada tarea que terminas.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start">
              <button onClick={login} className="btn-primary w-full px-6 py-3 text-base sm:w-auto">
                Continuar con Google
              </button>
              <a href="#descargas" className="btn-secondary w-full px-6 py-3 text-base sm:w-auto">
                Descargar la app
              </a>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <DemoTaskList />
          </div>
        </div>
      </section>

      <section className="border-y border-line/70 bg-surface">
        <div className="mx-auto grid max-w-6xl gap-6 px-6 py-16 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl p-2">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon size={22} />
              </span>
              <h2 className="mt-4 text-base font-bold text-ink">{title}</h2>
              <p className="mt-1.5 text-sm leading-6 text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <DownloadSection />

      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">Cómo empezar</h2>
        <ol className="mt-6 space-y-4">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-4">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">
                {index + 1}
              </span>
              <span className="pt-1 text-ink/90">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm text-muted">
          Solo usamos tu nombre y tu correo de Google para identificarte. No vendemos tus datos ni mostramos
          publicidad. Lee la{' '}
          <Link to="/privacidad" className="font-semibold text-brand hover:underline">
            política de privacidad
          </Link>
          .
        </p>
      </section>
    </PublicLayout>
  );
}

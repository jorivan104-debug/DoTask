import { CalendarDays, Home, Star, Sun, UserRound, type LucideIcon } from 'lucide-react';

export type SmartListKind = 'my-day' | 'important' | 'planned' | 'assigned' | 'all';

export interface SmartListDef {
  kind: SmartListKind;
  /** Segmento de la URL en español. */
  slug: string;
  label: string;
  icon: LucideIcon;
  /** Clave en la respuesta de contadores. */
  countKey: 'myDay' | 'important' | 'planned' | 'assigned' | 'all';
  /** Color del ícono, como en To Do. */
  accent: string;
  emptyText: string;
}

export const SMART_LISTS: SmartListDef[] = [
  {
    kind: 'my-day',
    slug: 'mi-dia',
    label: 'Mi día',
    icon: Sun,
    countKey: 'myDay',
    accent: 'text-amber-500',
    emptyText: 'Concéntrate en tu día. Agrega tareas o revisa las sugerencias.',
  },
  {
    kind: 'important',
    slug: 'importante',
    label: 'Importante',
    icon: Star,
    countKey: 'important',
    accent: 'text-rose-500',
    emptyText: 'Marca tareas con la estrella para verlas aquí.',
  },
  {
    kind: 'planned',
    slug: 'planeado',
    label: 'Planeado',
    icon: CalendarDays,
    countKey: 'planned',
    accent: 'text-teal-600',
    emptyText: 'Las tareas con fecha de vencimiento aparecen aquí.',
  },
  {
    kind: 'assigned',
    slug: 'asignadas',
    label: 'Asignado a mí',
    icon: UserRound,
    countKey: 'assigned',
    accent: 'text-emerald-600',
    emptyText: 'No tienes tareas asignadas pendientes.',
  },
  {
    kind: 'all',
    slug: 'tareas',
    label: 'Tareas',
    icon: Home,
    countKey: 'all',
    accent: 'text-blue-600',
    emptyText: 'No hay tareas pendientes en este espacio.',
  },
];

export const smartListBySlug = (slug: string) => SMART_LISTS.find((s) => s.slug === slug);
export const smartListByKind = (kind: SmartListKind) => SMART_LISTS.find((s) => s.kind === kind)!;

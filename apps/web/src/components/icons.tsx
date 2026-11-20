/**
 * Familia de íconos de DoTask (Lucide): mismo grosor de línea y esquinas suaves.
 * Usa estos nombres en lugar de importar Lucide directamente, para mantener la familia.
 */
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Ellipsis,
  Flag,
  Folder,
  LayoutGrid,
  ListChecks,
  LogOut,
  Plus,
  SquareCheckBig,
  Trash2,
  type LucideProps,
} from 'lucide-react';

const withDefaults = (Icon: React.ComponentType<LucideProps>, label: string) => {
  const Component = ({ size = 18, strokeWidth = 2, ...props }: LucideProps) => (
    <Icon size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" {...props} />
  );
  Component.displayName = label;
  return Component;
};

/** Mis tareas: lista con casillas. */
export const MyTasksIcon = withDefaults(ListChecks, 'MyTasksIcon');
/** Proyectos: carpeta. */
export const ProjectIcon = withDefaults(Folder, 'ProjectIcon');
/** Fechas: calendario. */
export const DateIcon = withDefaults(CalendarDays, 'DateIcon');
/** Recordatorios: campana. */
export const ReminderIcon = withDefaults(Bell, 'ReminderIcon');
/** Completar tarea: casilla con chulito. */
export const CompleteIcon = withDefaults(SquareCheckBig, 'CompleteIcon');
/** Por vencer: reloj. */
export const DueSoonIcon = withDefaults(Clock, 'DueSoonIcon');
export const AddIcon = withDefaults(Plus, 'AddIcon');
export const BackIcon = withDefaults(ChevronLeft, 'BackIcon');
export const ForwardIcon = withDefaults(ChevronRight, 'ForwardIcon');
export const MoreIcon = withDefaults(Ellipsis, 'MoreIcon');
/** Hitos: bandera. */
export const MilestoneIcon = withDefaults(Flag, 'MilestoneIcon');
/** Espacios de trabajo. */
export const SpacesIcon = withDefaults(LayoutGrid, 'SpacesIcon');
export const LogoutIcon = withDefaults(LogOut, 'LogoutIcon');
export const DeleteIcon = withDefaults(Trash2, 'DeleteIcon');

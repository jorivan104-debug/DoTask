import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import type { TaskStep } from '../../hooks/useTaskDetail';

type Props = {
  steps: TaskStep[];
  onAdd: (title: string) => Promise<unknown>;
  onUpdate: (stepId: string, patch: { title?: string; isChecked?: boolean }) => void;
  onRemove: (stepId: string) => void;
};

/** Pasos de la tarea (checklist), como en To Do. */
export default function StepsSection({ steps, onAdd, onUpdate, onRemove }: Props) {
  const [title, setTitle] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = title.trim();
    if (!value) return;
    setTitle('');
    await onAdd(value);
  };

  return (
    <div className="py-1">
      <ul>
        {steps.map((s) => (
          <StepItem key={s.id} step={s} onUpdate={onUpdate} onRemove={onRemove} />
        ))}
      </ul>
      <form onSubmit={submit} className="flex items-center gap-3 px-3 py-2">
        <Plus className="h-4 w-4 shrink-0 text-blue-600" aria-hidden />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={steps.length ? 'Siguiente paso' : 'Agregar paso'}
          aria-label="Nuevo paso"
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-blue-700 focus:outline-none focus:placeholder:text-gray-400"
        />
      </form>
    </div>
  );
}

function StepItem({
  step,
  onUpdate,
  onRemove,
}: {
  step: TaskStep;
  onUpdate: Props['onUpdate'];
  onRemove: Props['onRemove'];
}) {
  const [title, setTitle] = useState<string | null>(null);

  const save = () => {
    const value = (title ?? '').trim();
    if (title !== null && value && value !== step.title) onUpdate(step.id, { title: value });
    setTitle(null);
  };

  return (
    <li className="group flex items-center gap-3 rounded-md px-3 py-1.5 hover:bg-gray-50">
      <button
        type="button"
        onClick={() => onUpdate(step.id, { isChecked: !step.isChecked })}
        aria-label={step.isChecked ? `Desmarcar ${step.title}` : `Marcar ${step.title}`}
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
          step.isChecked ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-400 text-transparent hover:text-blue-600'
        }`}
      >
        <Check className="h-2.5 w-2.5" strokeWidth={3} />
      </button>
      <input
        value={title ?? step.title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Título del paso"
        className={`min-w-0 flex-1 bg-transparent text-sm focus:outline-none ${
          step.isChecked ? 'text-gray-400 line-through' : 'text-gray-800'
        }`}
      />
      <button
        type="button"
        onClick={() => onRemove(step.id)}
        aria-label={`Eliminar paso ${step.title}`}
        className="rounded p-0.5 text-gray-400 opacity-100 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}

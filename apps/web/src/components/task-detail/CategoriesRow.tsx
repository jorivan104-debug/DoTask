import { useState } from 'react';
import { Check, Tag } from 'lucide-react';
import type { CategoryRef } from '../../hooks/useSmartLists';
import {
  CATEGORY_COLORS,
  CATEGORY_STYLES,
  type CategoryColor,
  useCategories,
  useCreateCategory,
} from '../../hooks/useTaskDetail';
import PropertyMenu from './PropertyMenu';

type Props = {
  workspaceId: string;
  selected: CategoryRef[];
  onChange: (categoryIds: string[]) => void;
};

/** "Elegir una categoría": etiquetas de color compartidas por el espacio. */
export default function CategoriesRow({ workspaceId, selected, onChange }: Props) {
  const categoriesQ = useCategories(workspaceId);
  const create = useCreateCategory(workspaceId);
  const [name, setName] = useState('');
  const [color, setColor] = useState<CategoryColor>('blue');
  const selectedIds = selected.map((c) => c.id);

  const toggle = (id: string) =>
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const created = await create.mutateAsync({ name: name.trim(), color });
    setName('');
    onChange([...selectedIds, created.id]);
  };

  return (
    <div>
      <PropertyMenu
        icon={Tag}
        placeholder="Elegir una categoría"
        value={selected.length ? `${selected.length} ${selected.length === 1 ? 'categoría' : 'categorías'}` : null}
        onClear={() => onChange([])}
      >
        {() => (
          <>
            {(categoriesQ.data ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                <span className={`h-3 w-3 shrink-0 rounded-full ${CATEGORY_STYLES[c.color]?.dot ?? 'bg-gray-400'}`} />
                <span className="flex-1 text-gray-800">{c.name}</span>
                {selectedIds.includes(c.id) && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            ))}
            <form onSubmit={submit} className="border-t border-gray-100 px-3 py-2">
              <p className="mb-1 text-xs font-medium text-gray-500">Nueva categoría</p>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nombre"
                maxLength={50}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-1.5" role="radiogroup" aria-label="Color">
                {CATEGORY_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={color === c}
                    aria-label={c}
                    onClick={() => setColor(c)}
                    className={`h-5 w-5 rounded-full ${CATEGORY_STYLES[c]!.dot} ${color === c ? 'ring-2 ring-gray-900 ring-offset-1' : ''}`}
                  />
                ))}
                <button
                  type="submit"
                  disabled={!name.trim() || create.isPending}
                  className="ml-auto rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Crear
                </button>
              </div>
              {create.isError && <p className="mt-1 text-xs text-red-600">{(create.error as Error).message}</p>}
            </form>
          </>
        )}
      </PropertyMenu>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2 pl-[42px]">
          {selected.map((c) => (
            <CategoryChip key={c.id} category={c} />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategoryChip({ category, small = false }: { category: CategoryRef; small?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${CATEGORY_STYLES[category.color]?.chip ?? 'bg-gray-200 text-gray-800'} ${
        small ? 'px-1.5 py-px text-[10px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      {category.name}
    </span>
  );
}

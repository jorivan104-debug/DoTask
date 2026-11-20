import { useState } from 'react';
import { Bot, ExternalLink, FileText, FolderOpen, Globe, HardDrive, Link2, Loader2, Sheet, X, Presentation } from 'lucide-react';
import type { LinkedResource } from '../../hooks/useTaskDetail';
import { useDriveConfig } from '../../hooks/useTaskDetail';
import { guessDriveName, isDriveUrl, pickDriveFiles } from '../../lib/googleDrive';

type NewLink = {
  applicationName: 'Google Drive' | 'Claude' | 'Web';
  displayName: string;
  webUrl: string;
  externalId?: string;
  mimeType?: string;
};

type Props = {
  links: LinkedResource[];
  onAdd: (link: NewLink) => Promise<unknown>;
  onRemove: (linkId: string) => void;
};

function iconFor(link: LinkedResource) {
  if (link.applicationName === 'Claude') return Bot;
  if (link.applicationName === 'Web') return Globe;
  const mime = link.mimeType ?? '';
  const url = link.webUrl ?? '';
  if (mime.includes('spreadsheet') || url.includes('/spreadsheets/')) return Sheet;
  if (mime.includes('presentation') || url.includes('/presentation/')) return Presentation;
  if (mime.includes('folder') || url.includes('/folders/')) return FolderOpen;
  if (mime.includes('document') || url.includes('/document/')) return FileText;
  return HardDrive;
}

/**
 * Archivos de Google Drive y chats de Claude vinculados. DoTask no almacena
 * archivos: solo guarda el enlace al archivo, que sigue viviendo en Drive.
 */
export default function LinksSection({ links, onAdd, onRemove }: Props) {
  const driveQ = useDriveConfig();
  const [mode, setMode] = useState<null | 'drive' | 'claude'>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickerEnabled = !!driveQ.data?.enabled;

  const openDrive = async () => {
    setError(null);
    if (!pickerEnabled) return setMode('drive');
    setPicking(true);
    try {
      const { clientId, apiKey, appId } = driveQ.data!;
      const files = await pickDriveFiles({ clientId: clientId!, apiKey: apiKey!, appId: appId! });
      for (const f of files) {
        await onAdd({ applicationName: 'Google Drive', displayName: f.name, webUrl: f.url, externalId: f.id, mimeType: f.mimeType });
      }
    } catch (e) {
      setError((e as Error).message);
      setMode('drive');
    } finally {
      setPicking(false);
    }
  };

  const submitPasted = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = url.trim();
    if (mode === 'drive' && !isDriveUrl(value)) return setError('Pega un enlace de drive.google.com o docs.google.com');
    if (mode === 'claude' && !/^https:\/\/claude\.ai\//.test(value)) return setError('Pega el enlace de un chat de claude.ai');
    try {
      await onAdd({
        applicationName: mode === 'claude' ? 'Claude' : 'Google Drive',
        displayName: title.trim() || (mode === 'claude' ? 'Chat de Claude' : guessDriveName(value)),
        webUrl: value,
      });
      setUrl('');
      setTitle('');
      setMode(null);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="py-1">
      {links.length > 0 && (
        <ul className="mb-1">
          {links.map((l) => {
            const Icon = iconFor(l);
            return (
              <li key={l.id} className="group flex items-center gap-3 rounded-md px-3 py-1.5 hover:bg-gray-50">
                <Icon className={`h-[18px] w-[18px] shrink-0 ${l.applicationName === 'Claude' ? 'text-orange-600' : 'text-green-700'}`} aria-hidden />
                <a href={l.webUrl ?? '#'} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm text-gray-800 hover:text-blue-700 hover:underline">
                  {l.displayName}
                </a>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-gray-300" aria-hidden />
                <button
                  type="button"
                  onClick={() => onRemove(l.id)}
                  aria-label={`Quitar ${l.displayName}`}
                  className="rounded p-0.5 text-gray-400 hover:text-red-600 md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void openDrive()}
        disabled={picking}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50"
      >
        {picking ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <HardDrive className="h-[18px] w-[18px]" aria-hidden />}
        Agregar archivo de Google Drive
      </button>
      <button
        type="button"
        onClick={() => setMode(mode === 'claude' ? null : 'claude')}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-gray-600 hover:bg-gray-50"
      >
        <Link2 className="h-[18px] w-[18px]" aria-hidden />
        Vincular chat de Claude
      </button>

      {mode && (
        <form onSubmit={submitPasted} className="mx-3 mb-2 space-y-1.5 rounded-md bg-gray-50 p-2">
          <p className="text-xs text-gray-500">
            {mode === 'drive'
              ? 'Pega el enlace del archivo de Drive (Compartir → Copiar enlace).'
              : 'Pega el enlace del chat de claude.ai.'}
          </p>
          <input
            autoFocus
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={mode === 'drive' ? 'https://docs.google.com/…' : 'https://claude.ai/chat/…'}
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Nombre (opcional)"
            className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => { setMode(null); setError(null); }} className="px-2 py-1 text-xs text-gray-600 hover:underline">
              Cancelar
            </button>
            <button type="submit" disabled={!url.trim()} className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
              Guardar enlace
            </button>
          </div>
        </form>
      )}
      {error && <p className="px-3 pb-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

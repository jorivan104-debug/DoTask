import { useEffect, useState } from 'react';
import {
  DOWNLOADS,
  RELEASES_PAGE,
  detectPlatform,
  fetchAvailableAssets,
  isInsideApp,
  type DownloadOption,
} from '../../lib/downloads';

/**
 * Descargas de las apps de Windows y Android. Destaca la de la plataforma del
 * visitante y deja la otra como alternativa. Se oculta dentro de las propias apps.
 */
export default function DownloadSection() {
  const [available, setAvailable] = useState<Set<string> | null | undefined>(undefined);
  const platform = detectPlatform(navigator.userAgent);

  useEffect(() => {
    const controller = new AbortController();
    fetchAvailableAssets(controller.signal).then(setAvailable);
    return () => controller.abort();
  }, []);

  if (isInsideApp()) return null;

  // Sin respuesta de GitHub (null) se asume que están publicadas.
  const isReady = (option: DownloadOption) =>
    available === undefined || available === null || available.has(option.fileName);

  const primary = platform === 'other' ? null : DOWNLOADS[platform];
  const others = Object.values(DOWNLOADS).filter((option) => option !== primary);

  return (
    <section id="descargas" className="border-t border-gray-100">
      <div className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Descarga DoTask</h2>
        <p className="mt-2 max-w-2xl text-gray-600">
          Usa DoTask como una aplicación en tu computador o en tu celular. Tus tareas son las
          mismas en todas partes: entras con la misma cuenta de Google.
        </p>

        {primary && (
          <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50/60 p-6">
            <p className="text-sm font-medium text-blue-800">
              Recomendado para tu {primary.platform === 'windows' ? 'computador' : 'celular'}
            </p>
            <DownloadButton option={primary} ready={isReady(primary)} prominent />
          </div>
        )}

        <div className={`mt-6 grid gap-4 ${primary ? '' : 'sm:grid-cols-2'}`}>
          {others.map((option) => (
            <div key={option.platform} className="rounded-2xl border border-gray-200 p-6">
              <DownloadButton option={option} ready={isReady(option)} />
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-gray-500">
          ¿Usas otro sistema? Puedes usar DoTask desde el navegador o instalarlo con la opción
          «Instalar aplicación» de Chrome o Edge. Todas las versiones están en{' '}
          <a href={RELEASES_PAGE} className="font-medium text-blue-700 hover:underline">
            GitHub
          </a>
          .
        </p>
      </div>
    </section>
  );
}

function DownloadButton({
  option,
  ready,
  prominent = false,
}: {
  option: DownloadOption;
  ready: boolean;
  prominent?: boolean;
}) {
  return (
    <div className={prominent ? 'mt-3' : ''}>
      {ready ? (
        <a
          href={option.url}
          className={
            prominent
              ? 'inline-flex rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700'
              : 'inline-flex rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50'
          }
        >
          {option.label}
        </a>
      ) : (
        <span className="inline-flex rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-semibold text-gray-500">
          {option.label.replace('Descargar', 'Próximamente')}
        </span>
      )}
      <p className="mt-2 text-sm text-gray-600">{option.requirements}</p>
      {ready && <p className="mt-1 text-xs text-gray-500">{option.installHint}</p>}
    </div>
  );
}

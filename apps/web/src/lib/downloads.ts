/** Instaladores publicados por .github/workflows/release-apps.yml en GitHub Releases. */
export const RELEASES_REPO = 'jorivan104-debug/DoTask';
export const RELEASES_PAGE = `https://github.com/${RELEASES_REPO}/releases/latest`;

export type Platform = 'windows' | 'android' | 'other';

export interface DownloadOption {
  platform: Exclude<Platform, 'other'>;
  label: string;
  fileName: string;
  url: string;
  requirements: string;
  installHint: string;
}

export const DOWNLOADS: Record<DownloadOption['platform'], DownloadOption> = {
  windows: {
    platform: 'windows',
    label: 'Descargar para Windows',
    fileName: 'DoTask-Setup.exe',
    url: `https://github.com/${RELEASES_REPO}/releases/latest/download/DoTask-Setup.exe`,
    requirements: 'Windows 10 u 11 (64 bits)',
    installHint:
      'Si Windows SmartScreen muestra un aviso, pulsa «Más información» y luego «Ejecutar de todas formas».',
  },
  android: {
    platform: 'android',
    label: 'Descargar para Android',
    fileName: 'DoTask.apk',
    url: `https://github.com/${RELEASES_REPO}/releases/latest/download/DoTask.apk`,
    requirements: 'Android 5.0 o superior, con Google Chrome',
    installHint:
      'La primera vez, Android te pedirá permitir «Instalar apps desconocidas» para tu navegador.',
  },
};

/** Plataforma del visitante a partir del user agent. */
export function detectPlatform(userAgent: string): Platform {
  if (/android/i.test(userAgent)) return 'android';
  if (/windows nt/i.test(userAgent)) return 'windows';
  return 'other';
}

/**
 * ¿Ya estamos dentro de una app de DoTask? (escritorio, Android TWA o PWA instalada)
 * En ese caso no tiene sentido ofrecer la descarga.
 */
export function isInsideApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (/DoTaskDesktop\//.test(navigator.userAgent)) return true;
  if (document.referrer.startsWith('android-app://')) return true;
  return window.matchMedia?.('(display-mode: standalone)').matches ?? false;
}

/**
 * Nombres de los instaladores disponibles en la última release.
 * Devuelve null si GitHub no responde (p. ej. límite de peticiones): en ese caso
 * se muestran los enlaces igualmente.
 */
export async function fetchAvailableAssets(signal?: AbortSignal): Promise<Set<string> | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal,
    });
    if (res.status === 404) return new Set();
    if (!res.ok) return null;
    const release = (await res.json()) as { assets?: { name: string }[] };
    return new Set((release.assets ?? []).map((asset) => asset.name));
  } catch {
    return null;
  }
}

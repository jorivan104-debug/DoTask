/**
 * Selector de archivos de Google Drive (Google Picker). DoTask no guarda los
 * archivos: el usuario elige uno o varios y solo se guarda su enlace en la tarea.
 * El acceso usa el alcance `drive.file` (solo los archivos que el usuario elige).
 */

export interface DriveFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
}

interface DriveConfig {
  clientId: string;
  apiKey: string;
  appId: string;
}

/* Tipos mínimos de las librerías de Google que se cargan en tiempo de ejecución. */
type TokenResponse = { access_token?: string; error?: string };
type PickerDoc = { id: string; name: string; url: string; mimeType: string };
type PickerData = { action: string; docs?: PickerDoc[] };
type GoogleGlobal = {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (resp: TokenResponse) => void;
        error_callback?: (err: { type: string }) => void;
      }): { requestAccessToken(opts?: { prompt?: string }): void };
    };
  };
  picker: {
    Action: { PICKED: string; CANCEL: string };
    ViewId: { DOCS: string };
    Feature: { MULTISELECT_ENABLED: string };
    DocsView: new (viewId?: string) => { setIncludeFolders(v: boolean): unknown; setMode?(m: string): unknown };
    PickerBuilder: new () => {
      addView(view: unknown): PickerBuilderChain;
    };
  };
};
type PickerBuilderChain = {
  addView(view: unknown): PickerBuilderChain;
  enableFeature(f: string): PickerBuilderChain;
  setOAuthToken(t: string): PickerBuilderChain;
  setDeveloperKey(k: string): PickerBuilderChain;
  setAppId(id: string): PickerBuilderChain;
  setLocale(l: string): PickerBuilderChain;
  setCallback(cb: (data: PickerData) => void): PickerBuilderChain;
  build(): { setVisible(v: boolean): void };
};

declare global {
  interface Window {
    google?: GoogleGlobal;
    gapi?: { load(name: string, cb: () => void): void };
  }
}

const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const loaded = new Map<string, Promise<void>>();

function loadScript(src: string): Promise<void> {
  if (!loaded.has(src)) {
    loaded.set(
      src,
      new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('No se pudo cargar Google Drive'));
        document.head.appendChild(s);
      }),
    );
  }
  return loaded.get(src)!;
}

let cachedToken: { value: string; expires: number } | null = null;

function requestToken(clientId: string): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now()) return Promise.resolve(cachedToken.value);
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp) => {
        if (!resp.access_token) return reject(new Error('Google no dio acceso a Drive'));
        cachedToken = { value: resp.access_token, expires: Date.now() + 50 * 60_000 };
        resolve(resp.access_token);
      },
      error_callback: () => reject(new Error('Se canceló el acceso a Google Drive')),
    });
    client.requestAccessToken({ prompt: cachedToken ? '' : 'consent' });
  });
}

/** Abre el selector de Drive y devuelve los archivos elegidos (vacío si se cancela). */
export async function pickDriveFiles(config: DriveConfig): Promise<DriveFile[]> {
  await Promise.all([loadScript('https://accounts.google.com/gsi/client'), loadScript('https://apis.google.com/js/api.js')]);
  await new Promise<void>((resolve) => window.gapi!.load('picker', resolve));
  const token = await requestToken(config.clientId);
  const g = window.google!;

  return new Promise((resolve) => {
    const view = new g.picker.DocsView(g.picker.ViewId.DOCS);
    view.setIncludeFolders(true);
    new g.picker.PickerBuilder()
      .addView(view)
      .enableFeature(g.picker.Feature.MULTISELECT_ENABLED)
      .setOAuthToken(token)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setLocale('es')
      .setCallback((data) => {
        if (data.action === g.picker.Action.PICKED) {
          resolve((data.docs ?? []).map((d) => ({ id: d.id, name: d.name, url: d.url, mimeType: d.mimeType })));
        } else if (data.action === g.picker.Action.CANCEL) {
          resolve([]);
        }
      })
      .build()
      .setVisible(true);
  });
}

/** Nombre legible a partir de un enlace pegado de Drive/Docs. */
export function guessDriveName(url: string): string {
  try {
    const { pathname } = new URL(url);
    if (pathname.includes('/spreadsheets/')) return 'Hoja de cálculo de Google';
    if (pathname.includes('/presentation/')) return 'Presentación de Google';
    if (pathname.includes('/document/')) return 'Documento de Google';
    if (pathname.includes('/forms/')) return 'Formulario de Google';
    if (pathname.includes('/folders/')) return 'Carpeta de Drive';
    return 'Archivo de Drive';
  } catch {
    return 'Archivo de Drive';
  }
}

export const DRIVE_HOSTS = ['drive.google.com', 'docs.google.com'];

export function isDriveUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && DRIVE_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}

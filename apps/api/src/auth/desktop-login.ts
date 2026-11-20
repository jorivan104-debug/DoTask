import { createHash, timingSafeEqual } from 'crypto';

/**
 * Login de la app de escritorio (Windows).
 *
 * Google no permite iniciar sesión dentro de ventanas embebidas (Electron), así que
 * la app abre el login en el navegador del sistema y recibe el resultado por el
 * protocolo `dotask://`. Para que interceptar ese enlace no sirva de nada, la app
 * genera un verificador secreto y solo envía su hash (reto PKCE, RFC 7636):
 *
 * 1. App → navegador: `/v1/auth/login?client=desktop&challenge=<sha256(verifier)>`
 * 2. Google → `/v1/auth/callback` → `<web>/app/abrir?code=<código sellado {uid, ch}>`
 * 3. La web abre `dotask://auth?code=…`; la app carga
 *    `/v1/auth/desktop/exchange?code=…&verifier=…`, que fija la cookie de sesión.
 */
export const DESKTOP_CODE_PURPOSE = 'desktop-code';
export const DESKTOP_CODE_TTL_MS = 2 * 60 * 1000;

/** Contenido del código de un solo uso (sellado y firmado con SESSION_SECRET). */
export interface DesktopCode {
  uid: string;
  ch: string;
}

/** Un reto PKCE S256 son 32 bytes en base64url: 43 caracteres. */
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
/** Verificador PKCE: 43–128 caracteres del alfabeto no reservado (RFC 7636 §4.1). */
const VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export function isValidChallenge(value: unknown): value is string {
  return typeof value === 'string' && CHALLENGE_PATTERN.test(value);
}

export function challengeFor(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

/** Comprueba en tiempo constante que el verificador corresponde al reto. */
export function verifierMatches(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== 'string' || !VERIFIER_PATTERN.test(verifier)) return false;
  const expected = Buffer.from(challenge);
  const actual = Buffer.from(challengeFor(verifier));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

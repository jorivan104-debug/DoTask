'use strict';

const crypto = require('node:crypto');

/**
 * Login de escritorio con PKCE (ver apps/api/src/auth/desktop-login.ts).
 * El verificador nunca sale de la app: al navegador solo va su hash.
 */
function createPkcePair() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

function loginUrl(apiUrl, challenge) {
  const url = new URL('/v1/auth/login', apiUrl);
  url.searchParams.set('client', 'desktop');
  url.searchParams.set('challenge', challenge);
  return url.toString();
}

function exchangeUrl(apiUrl, code, verifier) {
  const url = new URL('/v1/auth/desktop/exchange', apiUrl);
  url.searchParams.set('code', code);
  url.searchParams.set('verifier', verifier);
  return url.toString();
}

/** Extrae el código de `dotask://auth?code=…`; null si el enlace no es de login. */
function parseAuthDeepLink(link) {
  try {
    const url = new URL(link);
    if (url.protocol !== 'dotask:' || url.hostname !== 'auth') return null;
    const code = url.searchParams.get('code');
    return code && code.length < 4096 ? code : null;
  } catch {
    return null;
  }
}

/** ¿La navegación va al inicio de sesión del API? (se hace en el navegador del sistema) */
function isLoginNavigation(target, apiUrl) {
  try {
    const url = new URL(target);
    const api = new URL(apiUrl);
    return url.origin === api.origin && url.pathname === '/v1/auth/login';
  } catch {
    return false;
  }
}

/** ¿La URL pertenece a DoTask (web o API)? Lo demás se abre en el navegador. */
function isInternalUrl(target, appUrl, apiUrl) {
  try {
    const origin = new URL(target).origin;
    return origin === new URL(appUrl).origin || origin === new URL(apiUrl).origin;
  } catch {
    return false;
  }
}

module.exports = {
  createPkcePair,
  loginUrl,
  exchangeUrl,
  parseAuthDeepLink,
  isLoginNavigation,
  isInternalUrl,
};

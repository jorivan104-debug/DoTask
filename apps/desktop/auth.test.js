'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  createPkcePair,
  loginUrl,
  exchangeUrl,
  parseAuthDeepLink,
  isLoginNavigation,
  isInternalUrl,
} = require('./auth');

const APP = 'https://dotaskweb.app-sprint.com';
const API = 'https://api.app-sprint.com';

test('el reto es el SHA-256 del verificador en base64url (43 caracteres)', () => {
  const { verifier, challenge } = createPkcePair();
  assert.equal(challenge.length, 43);
  assert.equal(challenge, crypto.createHash('sha256').update(verifier).digest('base64url'));
  assert.match(verifier, /^[A-Za-z0-9_-]{43}$/);
});

test('cada login usa un verificador distinto', () => {
  assert.notEqual(createPkcePair().verifier, createPkcePair().verifier);
});

test('construye las URL de login y de canje', () => {
  const login = new URL(loginUrl(API, 'abc'));
  assert.equal(login.origin + login.pathname, `${API}/v1/auth/login`);
  assert.equal(login.searchParams.get('client'), 'desktop');
  assert.equal(login.searchParams.get('challenge'), 'abc');

  const exchange = new URL(exchangeUrl(API, 'v1.a+b/c', 'ver'));
  assert.equal(exchange.pathname, '/v1/auth/desktop/exchange');
  assert.equal(exchange.searchParams.get('code'), 'v1.a+b/c');
  assert.equal(exchange.searchParams.get('verifier'), 'ver');
});

test('solo acepta enlaces dotask://auth con código', () => {
  assert.equal(parseAuthDeepLink('dotask://auth?code=v1.xyz.sig'), 'v1.xyz.sig');
  assert.equal(parseAuthDeepLink('dotask://otra?code=x'), null);
  assert.equal(parseAuthDeepLink('https://auth?code=x'), null);
  assert.equal(parseAuthDeepLink('dotask://auth'), null);
  assert.equal(parseAuthDeepLink('no es una url'), null);
});

test('detecta la navegación al login del API', () => {
  assert.equal(isLoginNavigation(`${API}/v1/auth/login`, API), true);
  assert.equal(isLoginNavigation(`${API}/v1/auth/logout`, API), false);
  assert.equal(isLoginNavigation('https://evil.com/v1/auth/login', API), false);
});

test('distingue URLs internas de externas', () => {
  assert.equal(isInternalUrl(`${APP}/privacidad`, APP, API), true);
  assert.equal(isInternalUrl(`${API}/v1/auth/desktop/exchange`, APP, API), true);
  assert.equal(isInternalUrl('https://github.com', APP, API), false);
  assert.equal(isInternalUrl('javascript:alert(1)', APP, API), false);
});

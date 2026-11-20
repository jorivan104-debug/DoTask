import { randomBytes } from 'crypto';
import { challengeFor, isValidChallenge, verifierMatches } from './desktop-login';

describe('desktop-login (PKCE)', () => {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = challengeFor(verifier);

  it('genera retos S256 válidos de 43 caracteres', () => {
    expect(challenge).toHaveLength(43);
    expect(isValidChallenge(challenge)).toBe(true);
  });

  it('rechaza retos mal formados', () => {
    expect(isValidChallenge(undefined)).toBe(false);
    expect(isValidChallenge('corto')).toBe(false);
    expect(isValidChallenge(`${challenge}x`)).toBe(false);
    expect(isValidChallenge('a'.repeat(42) + '=')).toBe(false);
  });

  it('acepta solo el verificador que corresponde al reto', () => {
    expect(verifierMatches(verifier, challenge)).toBe(true);
    expect(verifierMatches(randomBytes(32).toString('base64url'), challenge)).toBe(false);
  });

  it('rechaza verificadores ausentes o fuera del formato RFC 7636', () => {
    expect(verifierMatches(undefined, challenge)).toBe(false);
    expect(verifierMatches('corto', challenge)).toBe(false);
    expect(verifierMatches(challenge, challenge)).toBe(false);
  });
});

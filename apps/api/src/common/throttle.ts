/** Límite general: 120 peticiones por minuto y cliente. */
export const DEFAULT_THROTTLE = { ttl: 60_000, limit: 120 };

/** Límite estricto para endpoints que adivinan secretos (login de desarrollo, códigos de invitación). */
export const STRICT_THROTTLE = { default: { ttl: 60_000, limit: 5 } };

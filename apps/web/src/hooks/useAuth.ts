import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../lib/api';

interface UserDto {
  id: string;
  email: string;
  displayName: string;
}

export function useAuth() {
  const [user, setUser] = useState<UserDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<UserDto>('/v1/auth/me')
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(() => {
    window.location.href = `${import.meta.env.VITE_API_URL ?? ''}/v1/auth/login`;
  }, []);

  const logout = useCallback(() => {
    window.location.href = `${import.meta.env.VITE_API_URL ?? ''}/v1/auth/logout`;
  }, []);

  return { user, loading, login, logout };
}

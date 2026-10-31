import { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ApiError, api, getAccessToken, setAccessToken, setAuthEventHandler } from '@/lib/api';

type AuthState = 'checking' | 'authenticated' | 'unauthenticated' | 'blocked';
type AuthContextValue = {
  state: AuthState;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  retry: () => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<AuthState>('checking');
  const [error, setError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setState('checking');
    setError(null);
    try {
      await api.auth.preflight();
      if (!getAccessToken()) return setState('unauthenticated');
      await api.auth.session();
      setState('authenticated');
    } catch (reason) {
      if (isBlocked(reason)) return setState('blocked');
      setAccessToken(null);
      setState('unauthenticated');
      if (!(reason instanceof ApiError && reason.status === 401)) {
        setError(reason instanceof Error ? reason.message : 'Backendul nu poate fi verificat momentan.');
      }
    }
  }, []);

  useEffect(() => {
    setAuthEventHandler((event) => {
      if (event === 'blocked') setState('blocked');
      else {
        setAccessToken(null);
        setState('unauthenticated');
      }
    });
    void bootstrap();
    return () => setAuthEventHandler(null);
  }, [bootstrap]);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const result = await api.auth.login(username, password);
      setAccessToken(result.accessToken);
      setState('authenticated');
    } catch (reason) {
      if (isBlocked(reason)) setState('blocked');
      else setError(reason instanceof Error ? reason.message : 'Autentificarea a eșuat.');
      throw reason;
    }
  }, []);

  const logout = useCallback(() => {
    setAccessToken(null);
    setState('unauthenticated');
  }, []);

  const value = useMemo(() => ({ state, error, login, retry: bootstrap, logout }), [bootstrap, error, login, logout, state]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth trebuie folosit în AuthProvider.');
  return value;
}

function isBlocked(reason: unknown) {
  if (!(reason instanceof ApiError) || !reason.payload || typeof reason.payload !== 'object') return false;
  return 'code' in reason.payload && reason.payload.code === 'BLOCKED_IP';
}

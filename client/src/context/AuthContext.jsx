import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
      setAuthError('');
      return data.user;
    } catch (error) {
      setUser(null);
      if (error.status === 503) setAuthError(error.message);
      return null;
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const handleInvalidated = () => { refresh(); };
    window.addEventListener('portal:auth-invalidated', handleInvalidated);
    return () => window.removeEventListener('portal:auth-invalidated', handleInvalidated);
  }, [refresh]);

  const login = useCallback(async (credentials) => {
    const data = await api.post('/auth/login', credentials);
    setUser(data.user); setAuthError(''); return data.user;
  }, []);
  const register = useCallback(async (details) => {
    const data = await api.post('/auth/register', details);
    setUser(data.user); setAuthError(''); return data.user;
  }, []);
  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } finally { setUser(null); }
  }, []);
  const value = useMemo(() => ({ user, loading, authError, login, register, logout, refresh }), [user, loading, authError, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}

import { createContext, useContext, useState, useEffect } from 'react';
import client from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    const u = localStorage.getItem('user');
    return u ? JSON.parse(u) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    client.get('/auth/me').then((r) => {
      setUser(r.data.user);
      localStorage.setItem('user', JSON.stringify(r.data.user));
    }).catch(() => {
      localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null);
    }).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const r = await client.post('/auth/login', { email, password });
    localStorage.setItem('token', r.data.token);
    localStorage.setItem('user', JSON.stringify(r.data.user));
    setUser(r.data.user);
    return r.data;
  };

  const logout = () => {
    localStorage.removeItem('token'); localStorage.removeItem('user'); setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

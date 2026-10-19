import { useState, useEffect } from 'react';
import { AuthContext } from './auth-context';
import { authService } from '../api/auth.service';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('supabase_token') || null);
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;
    let active = true;

    authService.me()
      .then(res => {
        if (active && res.status === 'success') setUser(res.data);
      })
      .catch(() => {
        if (active) {
          localStorage.removeItem('supabase_token');
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const login = (userData, jwtToken) => {
    setUser(userData);
    setToken(jwtToken);
    setLoading(false);
    localStorage.setItem('supabase_token', jwtToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setLoading(false);
    localStorage.removeItem('supabase_token');
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

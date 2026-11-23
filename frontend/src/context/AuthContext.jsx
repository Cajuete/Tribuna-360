import { useState, useEffect } from 'react';
import { AuthContext } from './auth-context';
import { authService } from '../api/auth.service';

const OFFLINE_USER_KEY = 'tribuna360_offline_user';

const readOfflineUser = () => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_USER_KEY) || 'null');
  } catch (error) {
    console.debug('[Auth] No se pudo leer el usuario offline:', error);
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(readOfflineUser);
  const [token, setToken] = useState(
    () => sessionStorage.getItem('supabase_token') || localStorage.getItem('supabase_token') || null
  );
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) return;
    let active = true;

    authService.me()
      .then((res) => {
        if (active && res.status === 'success') {
          setUser(res.data);
          if (res.data?.role === 'gate_operator' || res.data?.role === 'superadmin') {
            localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify({
              id: res.data.id,
              role: res.data.role,
              tenant_id: res.data.tenant_id,
            }));
          } else {
            localStorage.removeItem(OFFLINE_USER_KEY);
          }
        }
      })
      .catch((error) => {
        if (active) {
          if (!navigator.onLine || error instanceof TypeError) {
            const offlineUser = readOfflineUser();
            if (offlineUser) {
              setUser(offlineUser);
              return;
            }
          }
          localStorage.removeItem('supabase_token');
          sessionStorage.removeItem('supabase_token');
          localStorage.removeItem(OFFLINE_USER_KEY);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  const login = (userData, jwtToken, remember = true) => {
    setUser(userData);
    setToken(jwtToken);
    setLoading(false);
    if (userData?.role === 'gate_operator' || userData?.role === 'superadmin') {
      localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify({
        id: userData.id,
        role: userData.role,
        tenant_id: userData.tenant_id,
      }));
    } else {
      localStorage.removeItem(OFFLINE_USER_KEY);
    }
    (remember ? localStorage : sessionStorage).setItem('supabase_token', jwtToken);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    setLoading(false);
    localStorage.removeItem('supabase_token');
    sessionStorage.removeItem('supabase_token');
    localStorage.removeItem(OFFLINE_USER_KEY);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};

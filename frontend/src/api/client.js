export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1').replace(/\/$/, '');

export async function apiRequest(endpoint, options = {}) {
  const token = sessionStorage.getItem('supabase_token') || localStorage.getItem('supabase_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('supabase_token');
      sessionStorage.removeItem('supabase_token');
      throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    }
    throw new Error(data.message || 'Error en la comunicación con el servidor.');
  }

  return data;
}
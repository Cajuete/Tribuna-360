export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1').replace(/\/$/, '');

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

  const responseText = await response.text();
  let data;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('supabase_token');
      sessionStorage.removeItem('supabase_token');
      throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
    }
    if (import.meta.env.DEV && data && typeof data.error === 'string') {
      throw new Error(`${data.message || 'Error del servidor'}: ${data.error}`);
    }
    if (data && typeof data.message === 'string') throw new Error(data.message);
    throw new Error(`El servidor respondió con un formato inesperado (HTTP ${response.status}). Verifica que el backend esté actualizado y disponible.`);
  }

  if (!data || typeof data !== 'object') {
    throw new Error('El servidor devolvió una respuesta inválida. Verifica que la API esté disponible.');
  }

  return data;
}
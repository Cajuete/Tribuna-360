const API_BASE_URL = 'http://localhost:3000/api/v1';

export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('supabase_token');

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
    throw new Error(data.message || 'Error en la comunicación con el servidor.');
  }

  return data;
}
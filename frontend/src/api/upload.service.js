import { API_BASE_URL } from './client';

export const uploadService = {
  async clubLogo(file) {
    const body = new FormData();
    body.append('logo', file);

    const response = await fetch(`${API_BASE_URL}/uploads/logo`, { method: 'POST', body });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo subir la imagen.');
    }

    return data;
  },

  async productImage(file) {
    const body = new FormData();
    body.append('image', file);

    const response = await fetch(`${API_BASE_URL}/uploads/product`, {
      method: 'POST',
      body,
      headers: { Authorization: `Bearer ${sessionStorage.getItem('supabase_token') || localStorage.getItem('supabase_token') || ''}` },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo subir la imagen.');
    }

    return data;
  },

  async matchImage(file) {
    const body = new FormData();
    body.append('image', file);

    const response = await fetch(`${API_BASE_URL}/uploads/match`, {
      method: 'POST',
      body,
      headers: { Authorization: `Bearer ${sessionStorage.getItem('supabase_token') || localStorage.getItem('supabase_token') || ''}` },
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'No se pudo subir la imagen.');
    }

    return data;
  },
};

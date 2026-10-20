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
};

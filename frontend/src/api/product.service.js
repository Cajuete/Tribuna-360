import { apiRequest } from './client';

export const productService = {
  async getAll(qs = '') {
    return await apiRequest(`/productos${qs}`, { method: 'GET' });
  },

  async create(payload) {
    return await apiRequest('/productos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(id, payload) {
    return await apiRequest(`/productos/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async remove(id) {
    return await apiRequest(`/productos/${id}`, { method: 'DELETE' });
  },
};

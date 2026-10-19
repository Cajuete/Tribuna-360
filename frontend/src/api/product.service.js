import { apiRequest } from './client';

export const productService = {
  async getAll() {
    return await apiRequest('/productos', { method: 'GET' });
  },

  async create(payload) {
    return await apiRequest('/productos', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async remove(id) {
    return await apiRequest(`/productos/${id}`, { method: 'DELETE' });
  },
};

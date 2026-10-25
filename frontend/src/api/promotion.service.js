import { apiRequest } from './client';

export const promotionService = {
  async getAll(qs = '') {
    return await apiRequest(`/promotions${qs}`, { method: 'GET' });
  },

  async getMetrics(qs = '') {
    return await apiRequest(`/promotions/metrics${qs}`, { method: 'GET' });
  },

  async create(payload) {
    return await apiRequest('/promotions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(id, payload) {
    return await apiRequest(`/promotions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async remove(id) {
    return await apiRequest(`/promotions/${id}`, { method: 'DELETE' });
  },
};
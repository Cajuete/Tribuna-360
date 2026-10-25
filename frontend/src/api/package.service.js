import { apiRequest } from './client';

export const packageService = {
  async getAll(qs = '') {
    return await apiRequest(`/packages${qs}`, { method: 'GET' });
  },
  async create(payload) {
    return await apiRequest('/packages', { method: 'POST', body: JSON.stringify(payload) });
  },
  async update(id, payload) {
    return await apiRequest(`/packages/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async remove(id) {
    return await apiRequest(`/packages/${id}`, { method: 'DELETE' });
  },
};

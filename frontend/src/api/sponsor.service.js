import { apiRequest } from './client';

export const sponsorService = {
  async getAll(qs = '') {
    return await apiRequest(`/sponsors${qs}`, { method: 'GET' });
  },
  async create(payload) {
    return await apiRequest('/sponsors', { method: 'POST', body: JSON.stringify(payload) });
  },
  async update(id, payload) {
    return await apiRequest(`/sponsors/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },
  async remove(id) {
    return await apiRequest(`/sponsors/${id}`, { method: 'DELETE' });
  },
};

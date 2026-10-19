import { apiRequest } from './client';

export const clubRequestService = {
  async register(payload) {
    return await apiRequest('/club-requests', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getAll(query = '') {
    return await apiRequest(`/club-requests${query}`, { method: 'GET' });
  },
};

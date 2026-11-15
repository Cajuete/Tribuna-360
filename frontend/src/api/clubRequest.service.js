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

  async getStatus(statusToken) {
    return await apiRequest('/club-requests/status', {
      method: 'POST',
      body: JSON.stringify({ status_token: statusToken }),
    });
  },

  async resolve(id, decision, reviewNote) {
    return await apiRequest(`/club-requests/${id}/decision`, {
      method: 'PATCH',
      body: JSON.stringify({ decision, review_note: reviewNote }),
    });
  },
};

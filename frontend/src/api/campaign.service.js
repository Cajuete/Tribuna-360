import { apiRequest } from './client';

const queryString = (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const campaignService = {
  async getAll(qs = '') {
    return await apiRequest(`/campaigns${qs}`, { method: 'GET' });
  },

  async getPublic(filters = {}) {
    return await apiRequest(`/campaigns/public${queryString(filters)}`, { method: 'GET' });
  },

  async create(payload) {
    return await apiRequest('/campaigns', { method: 'POST', body: JSON.stringify(payload) });
  },

  async update(id, payload) {
    return await apiRequest(`/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
  },

  async setActive(id, isActive) {
    return await apiRequest(`/campaigns/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  },

  async remove(id) {
    return await apiRequest(`/campaigns/${id}`, { method: 'DELETE' });
  },
};

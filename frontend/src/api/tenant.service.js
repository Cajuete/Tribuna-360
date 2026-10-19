import { apiRequest } from './client';

export const tenantService = {
  async getAll() {
    return await apiRequest('/tenants', { method: 'GET' });
  },

  async create(payload) {
    return await apiRequest('/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(id, payload) {
    return await apiRequest(`/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

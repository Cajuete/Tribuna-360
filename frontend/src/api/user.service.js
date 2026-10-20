import { apiRequest } from './client';

export const userService = {
  async getAll() {
    return await apiRequest('/users', { method: 'GET' });
  },

  async create(payload) {
    return await apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async assignRole(id, payload) {
    return await apiRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

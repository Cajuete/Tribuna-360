import { apiRequest } from './client';

export const userService = {
  async getAll() {
    return await apiRequest('/users', { method: 'GET' });
  },

  async assignRole(id, payload) {
    return await apiRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

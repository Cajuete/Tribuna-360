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

  async resetPassword(id, password) {
    return await apiRequest(`/users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
  },

  async getMe() {
    return await apiRequest('/users/me', { method: 'GET' });
  },

  async updateMe(payload) {
    return await apiRequest('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

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

  async updateManagedProfile(id, payload) {
    return await apiRequest(`/users/${id}/profile`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async setActive(id, is_active) {
    return await apiRequest(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active }),
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

import { apiRequest } from './client';

export const authService = {
  async register(userData) {
    return await apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  async login(email, password) {
    return await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async me() {
    return await apiRequest('/auth/me');
  },

  async forgotPassword(email) {
    return await apiRequest('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token, password) {
    return await apiRequest('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },
};

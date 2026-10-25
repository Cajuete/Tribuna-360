import { apiRequest } from './client';

export const saasService = {
  async getOverview() {
    return await apiRequest('/saas/overview', { method: 'GET' });
  },
  async getSettings() {
    return await apiRequest('/saas/settings', { method: 'GET' });
  },
  async updateSettings(payload) {
    return await apiRequest('/saas/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
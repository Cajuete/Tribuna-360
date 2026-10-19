import { apiRequest } from './client';

export const associationService = {
  async getAll() {
    return await apiRequest('/associations', { method: 'GET' });
  },
};

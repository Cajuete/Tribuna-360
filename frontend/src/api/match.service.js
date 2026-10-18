import { apiRequest } from './client';

export const matchService = {
  async getAllMatches() {
    return await apiRequest('/matches', { method: 'GET' });
  },

  async createMatch(matchData) {
    return await apiRequest('/matches', {
      method: 'POST',
      body: JSON.stringify(matchData),
    });
  }
};
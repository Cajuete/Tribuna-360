import { apiRequest } from './client';

export const matchService = {
  async getAllMatches(qs = '') {
    return await apiRequest(`/matches${qs}`, { method: 'GET' });
  },

  async getMatchById(id) {
    return await apiRequest(`/matches/${id}`, { method: 'GET' });
  },

  async getZones(matchId) {
    return await apiRequest(`/matches/${matchId}/zones`, { method: 'GET' });
  },

  async createMatch(matchData) {
    return await apiRequest('/matches', {
      method: 'POST',
      body: JSON.stringify(matchData),
    });
  },

  async addZone(matchId, payload) {
    return await apiRequest(`/zones/${matchId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateZone(zoneId, payload) {
    return await apiRequest(`/zones/${zoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteZone(zoneId) {
    return await apiRequest(`/zones/${zoneId}`, { method: 'DELETE' });
  },
};

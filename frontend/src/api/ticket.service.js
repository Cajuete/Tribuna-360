import { apiRequest } from './client';

export const ticketService = {
  async joinQueue(matchId) {
    return await apiRequest(`/tickets/queue/${encodeURIComponent(matchId)}/join`, {
      method: 'POST',
    });
  },

  async getQueueStatus(matchId) {
    return await apiRequest(`/tickets/queue/${encodeURIComponent(matchId)}`, { method: 'GET' });
  },

  async leaveQueue(matchId) {
    return await apiRequest(`/tickets/queue/${encodeURIComponent(matchId)}`, { method: 'DELETE' });
  },

  async purchase(payload) {
    return await apiRequest('/tickets/purchase', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMyTickets() {
    return await apiRequest('/tickets/mine', { method: 'GET' });
  },

  async getAll(qs = '') {
    return await apiRequest(`/tickets${qs}`, { method: 'GET' });
  },

  async scanTicket(qrCode) {
    return await apiRequest('/tickets/scan', {
      method: 'POST',
      body: JSON.stringify({ qr_code: qrCode }),
    });
  },

  async getOfflineMatches(tenantId) {
    const qs = tenantId ? `?tenant_id=${encodeURIComponent(tenantId)}` : '';
    return await apiRequest(`/tickets/offline/matches${qs}`);
  },

  async getOfflineManifest(matchId) {
    return await apiRequest(`/tickets/offline/manifest?match_id=${encodeURIComponent(matchId)}`);
  },

  async syncOfflineScans(matchId, scans) {
    return await apiRequest('/tickets/offline/sync', {
      method: 'POST',
      body: JSON.stringify({ match_id: matchId, scans }),
    });
  },
};

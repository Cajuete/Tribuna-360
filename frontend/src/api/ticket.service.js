import { apiRequest } from './client';

export const ticketService = {
  async purchase(payload) {
    return await apiRequest('/tickets/purchase', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMyTickets() {
    return await apiRequest('/tickets/mine', { method: 'GET' });
  },

  async scanTicket(qrCode) {
    return await apiRequest('/tickets/scan', {
      method: 'POST',
      body: JSON.stringify({ qr_code: qrCode }),
    });
  },
};

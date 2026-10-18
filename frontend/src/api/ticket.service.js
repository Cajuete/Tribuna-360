import { apiRequest } from './client';

export const ticketService = {
  async scanTicket(qrCode) {
    return await apiRequest('/tickets/scan', {
      method: 'POST',
      body: JSON.stringify({ qr_code: qrCode }),
    });
  }
};

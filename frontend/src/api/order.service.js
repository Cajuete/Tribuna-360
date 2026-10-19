import { apiRequest } from './client';

export const orderService = {
  async create(payload) {
    return await apiRequest('/orders', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getMyOrders() {
    return await apiRequest('/orders/mine', { method: 'GET' });
  },

  async getAll(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return await apiRequest(`/orders${qs}`, { method: 'GET' });
  },

  async updateStatus(id, status) {
    return await apiRequest(`/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
};

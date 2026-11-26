import { API_BASE_URL, apiRequest } from './client';

const getToken = () => sessionStorage.getItem('supabase_token') || localStorage.getItem('supabase_token') || '';

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

  async markDelivered(id, photo) {
    const body = new FormData();
    body.append('proof', photo);
    const response = await fetch(`${API_BASE_URL}/orders/${encodeURIComponent(id)}/deliver`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'No se pudo confirmar la entrega.');
    return data;
  },
};

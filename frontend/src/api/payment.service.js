import { API_BASE_URL, apiRequest } from './client';

const getToken = () => sessionStorage.getItem('supabase_token') || localStorage.getItem('supabase_token') || '';

const requestFile = async (endpoint, fieldName, file, extra = {}) => {
  const body = new FormData();
  if (file) body.append(fieldName, file);
  Object.entries(extra).forEach(([key, value]) => body.append(key, value));
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || 'No se pudo completar la operación.');
  return data;
};

const createIdempotencyKey = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
};

export const paymentService = {
  async create(purchaseType, data, queueToken) {
    return await apiRequest('/payments', {
      method: 'POST',
      body: JSON.stringify({
        purchase_type: purchaseType,
        data,
        queue_token: queueToken,
        idempotency_key: createIdempotencyKey(),
      }),
    });
  },

  async get(id) {
    return await apiRequest(`/payments/${encodeURIComponent(id)}`, { method: 'GET' });
  },

  async getMine() {
    return await apiRequest('/payments/mine', { method: 'GET' });
  },

  async getAll(status) {
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return await apiRequest(`/payments${query}`, { method: 'GET' });
  },

  async submitProof(id, file, buyerNote = '') {
    return await requestFile(`/payments/${encodeURIComponent(id)}/proof`, 'proof', file, {
      buyer_note: buyerNote,
    });
  },

  async resolve(id, decision, reviewNote = '') {
    return await apiRequest(`/payments/${encodeURIComponent(id)}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, review_note: reviewNote }),
    });
  },

  async updateSettings(payload) {
    return await apiRequest('/payments/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async uploadQr(file, tenantId) {
    return await requestFile('/payments/settings/qr', 'qr', file, tenantId ? { tenant_id: tenantId } : {});
  },
};

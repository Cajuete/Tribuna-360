import { apiRequest } from './client';

export const tenantService = {
  async getAll() {
    return await apiRequest('/tenants', { method: 'GET' });
  },

  async getBySlug(slug) {
    return await apiRequest(`/tenants/${encodeURIComponent(slug)}`, { method: 'GET' });
  },

  async getFollowed() {
    return await apiRequest('/tenants/follows/mine', { method: 'GET' });
  },

  async follow(id) {
    return await apiRequest(`/tenants/${encodeURIComponent(id)}/follow`, { method: 'POST' });
  },

  async unfollow(id) {
    return await apiRequest(`/tenants/${encodeURIComponent(id)}/follow`, { method: 'DELETE' });
  },

  async getDeliverySettings(tenantId) {
    return await apiRequest(`/tenants/delivery-settings/${encodeURIComponent(tenantId)}`, { method: 'GET' });
  },

  async create(payload) {
    return await apiRequest('/tenants', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async update(id, payload) {
    return await apiRequest(`/tenants/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

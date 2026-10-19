import { apiRequest } from './client';

export const membershipService = {
  async getPlans() {
    return await apiRequest('/memberships/plans', { method: 'GET' });
  },

  async subscribe(planId) {
    return await apiRequest('/memberships', {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId }),
    });
  },

  async getMine() {
    return await apiRequest('/memberships/mine', { method: 'GET' });
  },

  async cancel(id) {
    return await apiRequest(`/memberships/${id}/cancel`, { method: 'PATCH' });
  },

  async getAll(status) {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return await apiRequest(`/memberships${qs}`, { method: 'GET' });
  },

  async createPlan(payload) {
    return await apiRequest('/memberships/plans', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deletePlan(id) {
    return await apiRequest(`/memberships/plans/${id}`, { method: 'DELETE' });
  },
};

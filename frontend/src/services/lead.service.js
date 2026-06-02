import api from './api';

export const leadService = {
  getLeads: async (params = {}) => {
    const response = await api.get('/leads', { params });
    return response.data;
  },

  getLeadById: async (id) => {
    const response = await api.get(`/leads/${id}`);
    return response.data.data;
  },

  createLead: async (data) => {
    const response = await api.post('/leads', data);
    return response.data.data;
  },

  updateLead: async (id, data) => {
    const response = await api.put(`/leads/${id}`, data);
    return response.data.data;
  },

  deleteLead: async (id) => {
    const response = await api.delete(`/leads/${id}`);
    return response.data;
  },

  getLeadActivity: async (id, params = {}) => {
    const response = await api.get(`/leads/${id}/activity`, { params });
    return response.data;
  },
};

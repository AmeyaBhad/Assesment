import api from './api';

export const userService = {
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  getUserById: async (id) => {
    const response = await api.get(`/users/${id}`);
    return response.data.data;
  },

  updateUser: async (id, data) => {
    const response = await api.put(`/users/${id}`, data);
    return response.data.data;
  },

  getDashboard: async () => {
    const response = await api.get('/users/dashboard');
    return response.data.data;
  },

  getActivityFeed: async (params = {}) => {
    const response = await api.get('/users/activity', { params });
    return response.data;
  },

  registerUser: async (data) => {
    const response = await api.post('/auth/register', data);
    return response.data.data;
  },
};

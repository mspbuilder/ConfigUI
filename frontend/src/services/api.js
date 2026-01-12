import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      window.location.href = '/login';
    }
    if (error.response?.status === 403 && error.response?.data?.requireMfa) {
      // Redirect to MFA
      window.location.href = '/mfa';
    }
    return Promise.reject(error);
  }
);

export default {
  // Auth
  authenticateFromMojo(mojoToken) {
    return api.post('/auth/mojo-login', { mojoToken });
  },
  logout() {
    return api.post('/auth/logout');
  },
  checkAuth() {
    return api.get('/auth/check');
  },
  
  // MFA
  generateMfa() {
    return api.post('/auth/mfa/generate');
  },
  verifyMfa(token) {
    return api.post('/auth/mfa/verify', { token });
  },
  
  // Configs
  getConfigs(params) {
    return api.get('/configs', { params });
  },
  updateConfig(configId, data) {
    return api.put(`/configs/${configId}`, data);
  },
  createConfig(data) {
    return api.post('/configs', data);
  },
  deleteConfig(configId) {
    return api.delete(`/configs/${configId}`);
  },
  
  // Sections
  createSection(data) {
    return api.post('/sections', data);
  },

  // Dropdowns
  getCategories(customerId) {
    return api.get('/categories', { params: { customerId } });
  },
  getOrganizations(customerId) {
    return api.get('/organizations', { params: { customerId } });
  },
  getSites(customerId, organization) {
    return api.get('/sites', { params: { customerId, organization } });
  },
  getAgents(customerId, organization, site) {
    return api.get('/agents', { params: { customerId, organization, site } });
  },

  // Admin - get all customers for dropdown
  getCustomers() {
    return api.get('/customers');
  },

  // Get current user's roles
  getUserRoles() {
    return api.get('/auth/roles');
  },

  // Get datatype values for dropdown controls
  getDataTypeValues(dataTypeId) {
    return api.get(`/datatypes/${dataTypeId}/values`);
  },
};

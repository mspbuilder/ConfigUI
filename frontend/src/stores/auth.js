import { defineStore } from 'pinia';
import api from '../services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    authenticated: false,
    mfaVerified: false,
    loading: false,
    error: null,
  }),

  actions: {
    async authenticateFromMojo(mojoToken) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.authenticateFromMojo(mojoToken);
        this.user = response.data.user;
        this.authenticated = true;
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.error || 'Authentication failed';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async logout() {
      try {
        await api.logout();
      } finally {
        this.user = null;
        this.authenticated = false;
        this.mfaVerified = false;
      }
    },

    async checkAuth() {
      try {
        const response = await api.checkAuth();
        this.user = response.data.user;
        this.authenticated = response.data.authenticated;
        this.mfaVerified = response.data.mfaVerified;
        return response.data;
      } catch (error) {
        this.user = null;
        this.authenticated = false;
        this.mfaVerified = false;
        throw error;
      }
    },

    async verifyMfa(token) {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.verifyMfa(token);
        this.mfaVerified = true;
        return response.data;
      } catch (error) {
        this.error = error.response?.data?.error || 'MFA verification failed';
        throw error;
      } finally {
        this.loading = false;
      }
    },
  },
});

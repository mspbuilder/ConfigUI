import { defineStore } from 'pinia';
import api from '../services/api';

export const useFileSpecStore = defineStore('fileSpec', {
  state: () => ({
    fileSpecs: [],
    loading: false,
    error: null,
  }),

  getters: {
    sortedFileSpecs: (state) => {
      return [...state.fileSpecs].sort((a, b) =>
        (a.sort_order ?? 999) - (b.sort_order ?? 999)
      );
    }
  },

  actions: {
    async loadFileSpecs() {
      this.loading = true;
      this.error = null;
      try {
        const response = await api.getFileSpecs();
        this.fileSpecs = response.data.fileSpecs || [];
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load file specs';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateFileSpec(fileSpecId, data) {
      try {
        const response = await api.updateFileSpec(fileSpecId, data);
        if (response.data.blocked) {
          return { blocked: true, message: response.data.message };
        }
        await this.loadFileSpecs();
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to update file spec';
        throw error;
      }
    },
  },
});

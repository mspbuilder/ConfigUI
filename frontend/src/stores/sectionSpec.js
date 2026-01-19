import { defineStore } from 'pinia';
import api from '../services/api';

export const useSectionSpecStore = defineStore('sectionSpec', {
  state: () => ({
    sectionSpecs: [],
    fileSpecs: [], // For the file_desc dropdown filter
    selectedFileSpecId: null,
    loading: false,
    error: null,
  }),

  getters: {
    sortedSectionSpecs: (state) => {
      return [...state.sectionSpecs].sort((a, b) =>
        (a.sort_order ?? 999) - (b.sort_order ?? 999)
      );
    },
    fileSpecOptions: (state) => {
      return [...state.fileSpecs]
        .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999))
        .map(fs => ({ id: fs.file_spec_id, desc: fs.file_desc || fs.f_name }));
    }
  },

  actions: {
    async loadFileSpecs() {
      try {
        const response = await api.getFileSpecs();
        this.fileSpecs = response.data.fileSpecs || [];
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load file specs';
        throw error;
      }
    },

    async loadSectionSpecs(fileSpecId) {
      this.loading = true;
      this.error = null;
      this.selectedFileSpecId = fileSpecId;
      try {
        const response = await api.getSectionSpecs(fileSpecId);
        this.sectionSpecs = response.data.sectionSpecs || [];
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load section specs';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateSectionSpec(sectionSpecId, data) {
      try {
        const response = await api.updateSectionSpec(sectionSpecId, data);
        if (response.data.blocked) {
          return { blocked: true, message: response.data.message };
        }
        // Reload to get updated data
        if (this.selectedFileSpecId) {
          await this.loadSectionSpecs(this.selectedFileSpecId);
        }
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to update section spec';
        throw error;
      }
    },
  },
});

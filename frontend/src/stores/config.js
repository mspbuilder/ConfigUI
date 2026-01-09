import { defineStore } from 'pinia';
import api from '../services/api';

export const useConfigStore = defineStore('config', {
  state: () => ({
    configs: [],
    categories: [],
    organizations: [],
    sites: [],
    agents: [],
    selectedCustomerId: null,
    selectedCategory: null,
    selectedOrganization: null,
    selectedSite: null,
    selectedAgent: null,
    loading: false,
    error: null,
  }),

  getters: {
    groupedConfigs: (state) => {
      const groups = {};

      // Sort configs by Section_Sort then Property_Sort
      const sortedConfigs = [...state.configs].sort((a, b) => {
        const sectionSortA = parseInt(a.Section_Sort || a.section_sort || 0);
        const sectionSortB = parseInt(b.Section_Sort || b.section_sort || 0);
        if (sectionSortA !== sectionSortB) return sectionSortA - sectionSortB;

        const propSortA = parseInt(a.Property_Sort || a.property_sort || 0);
        const propSortB = parseInt(b.Property_Sort || b.property_sort || 0);
        return propSortA - propSortB;
      });

      sortedConfigs.forEach(config => {
        // Handle both uppercase and lowercase column names from SQL Server
        const section = config.section || config.Section || '';
        const sectionSort = config.Section_Sort || config.section_sort || 0;
        const key = `${sectionSort}_${section}`;

        if (!groups[key]) {
          groups[key] = {
            section: section,
            sectionToolTip: config.sectiontooltip || config.SectionToolTip || '',
            sectionSort: parseInt(sectionSort),
            items: [],
          };
        }
        groups[key].items.push(config);
      });

      // Return groups sorted by sectionSort
      return Object.values(groups).sort((a, b) => a.sectionSort - b.sectionSort);
    },
  },

  actions: {
    async loadCategories(customerId) {
      try {
        const response = await api.getCategories(customerId);
        this.categories = response.data.categories;
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load categories';
        throw error;
      }
    },

    async loadOrganizations(customerId) {
      try {
        const response = await api.getOrganizations(customerId);
        this.organizations = response.data.organizations;
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load organizations';
        throw error;
      }
    },

    async loadSites(customerId, organization) {
      try {
        const response = await api.getSites(customerId, organization);
        this.sites = response.data.sites;
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load sites';
        throw error;
      }
    },

    async loadAgents(customerId, organization, site) {
      try {
        const response = await api.getAgents(customerId, organization, site);
        this.agents = response.data.agents;
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load agents';
        throw error;
      }
    },

    async loadConfigs() {
      this.loading = true;
      this.error = null;
      try {
        const params = {
          customerId: this.selectedCustomerId,
          category: this.selectedCategory,
          organization: this.selectedOrganization,
          site: this.selectedSite,
          agent: this.selectedAgent,
        };
        const response = await api.getConfigs(params);
        this.configs = response.data.configs;
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load configurations';
        throw error;
      } finally {
        this.loading = false;
      }
    },

    async updateConfig(configId, value, level) {
      try {
        const response = await api.updateConfig(configId, { value, level });
        if (response.data.blocked) {
          return { blocked: true, message: response.data.message };
        }
        await this.loadConfigs();
        return { blocked: false };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to update configuration';
        throw error;
      }
    },

    async createConfig(configData) {
      try {
        await api.createConfig(configData);
        await this.loadConfigs();
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create configuration';
        throw error;
      }
    },

    async deleteConfig(configId) {
      try {
        const response = await api.deleteConfig(configId);
        if (response.data.blocked) {
          return { blocked: true, message: response.data.message };
        }
        await this.loadConfigs();
        return { blocked: false };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to delete configuration';
        throw error;
      }
    },

    setSelectedCustomerId(customerId) {
      this.selectedCustomerId = customerId;
      this.selectedCategory = null;
      this.selectedOrganization = null;
      this.selectedSite = null;
      this.selectedAgent = null;
    },

    setSelectedCategory(category) {
      this.selectedCategory = category;
    },

    setSelectedOrganization(organization) {
      this.selectedOrganization = organization;
      this.selectedSite = null;
      this.selectedAgent = null;
    },

    setSelectedSite(site) {
      this.selectedSite = site;
      this.selectedAgent = null;
    },

    setSelectedAgent(agent) {
      this.selectedAgent = agent;
    },
  },
});

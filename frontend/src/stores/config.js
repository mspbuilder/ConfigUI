import { defineStore } from 'pinia';
import api from '../services/api';

export const useConfigStore = defineStore('config', {
  state: () => ({
    configs: [],
    categories: [],           // Array of category objects: { f_name, sort_order, custom_sections_allowed, ... }
    organizations: [],
    sites: [],
    agents: [],
    customers: [],            // Admin only: list of all customers for dropdown
    selectedCustomerId: null,
    selectedCategory: null,   // The selected f_name value
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

    // Get category display names for dropdown (sorted by sort_order)
    // Uses legacy_category_name for display and API calls (matches cfg_overrides data)
    categoryNames: (state) => {
      return [...state.categories]
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map(cat => cat.legacy_category_name || cat);
    },

    // Get metadata for the currently selected category
    selectedCategoryMeta: (state) => {
      if (!state.selectedCategory) return null;
      return state.categories.find(cat =>
        (cat.legacy_category_name || cat) === state.selectedCategory
      ) || null;
    },
  },

  actions: {
    async loadCustomers() {
      try {
        const response = await api.getCustomers();
        this.customers = response.data.customers || [];
      } catch (error) {
        this.customers = [];
        throw error;
      }
    },

    async loadCategories(customerId) {
      try {
        const response = await api.getCategories(customerId);
        this.categories = response.data.categories;
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load categories';
        throw error;
      }
    },

    async loadOrganizations(customerId, category) {
      try {
        // Organizations require category to be selected (for override flags)
        if (!category) {
          this.organizations = [];
          return;
        }
        const response = await api.getOrganizations(customerId, category);
        this.organizations = response.data.organizations;
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load organizations';
        throw error;
      }
    },

    async loadSites(customerId, organization, category) {
      try {
        // Sites require category to be selected (for override flags)
        if (!category) {
          this.sites = [];
          return;
        }
        const response = await api.getSites(customerId, organization, category);
        this.sites = response.data.sites;
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to load sites';
        throw error;
      }
    },

    async loadAgents(customerId, organization, site, category) {
      try {
        // Agents require category to be selected (for override flags)
        if (!category) {
          this.agents = [];
          return;
        }
        const response = await api.getAgents(customerId, organization, site, category);
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

    async createSection(sectionName) {
      try {
        const response = await api.createSection({
          category: this.selectedCategory,
          sectionName,
          customerId: this.selectedCustomerId,
          organization: this.selectedOrganization,
          site: this.selectedSite,
          agent: this.selectedAgent
        });
        if (response.data.blocked) {
          return { blocked: true, message: response.data.message };
        }
        if (response.data.stub) {
          return { stub: true, message: response.data.message };
        }
        await this.loadConfigs();
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create section';
        throw error;
      }
    },

    async createRMSDCCEntry({ section, property, value }) {
      try {
        const response = await api.createRMSDCCEntry({
          customerId: this.selectedCustomerId,
          organizationId: this.selectedOrganization,
          site: this.selectedSite,
          agent: this.selectedAgent,
          section,
          property,
          value
        });
        if (response.data.blocked) {
          return { blocked: true, message: response.data.message };
        }
        await this.loadConfigs();
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create RMSDCC entry';
        throw error;
      }
    },

    async createMaintenanceTask({ taskName }) {
      try {
        const response = await api.createMaintenanceTask({
          customerId: this.selectedCustomerId,
          organization: this.selectedOrganization,
          site: this.selectedSite,
          agent: this.selectedAgent,
          section: taskName
        });
        if (response.data.blocked) {
          return { blocked: true, message: response.data.message };
        }
        await this.loadConfigs();
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create maintenance task';
        throw error;
      }
    },

    async createRMUOBASection({ updateType, organization, procedureName, yesNo, site }) {
      try {
        const response = await api.createRMUOBASection({
          updateType,
          customerId: this.selectedCustomerId,
          organization,
          procedureName,
          yesNo,
          site
        });
        if (response.data.blocked) {
          return { blocked: true, message: response.data.message };
        }
        await this.loadConfigs();
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create RMUOBA section';
        throw error;
      }
    },

    async createRMUOBAEntry({ updateType, property, value }) {
      try {
        const response = await api.createRMUOBAEntry({
          updateType,
          customerId: this.selectedCustomerId,
          property,
          value
        });
        if (response.data.blocked) {
          return { blocked: true, message: response.data.message };
        }
        await this.loadConfigs();
        return { success: true };
      } catch (error) {
        this.error = error.response?.data?.error || 'Failed to create RMUOBA entry';
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

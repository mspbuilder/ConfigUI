<template>
  <div class="config-manager">
    <header>
      <h1>Configuration Manager</h1>
      <div class="user-info">
        <span>{{ authStore.user?.username }}</span>
        <button @click="handleLogout" class="logout-btn">Logout</button>
      </div>
    </header>

    <div class="filters">
      <div class="filter-row">
        <select
          v-if="authStore.isAdmin"
          v-model="selectedCustomer"
          @change="handleCustomerChange"
          class="customer-select"
        >
          <option value="">Choose Customer</option>
          <option
            v-for="cust in configStore.customers"
            :key="cust.CustomerID"
            :value="cust.CustomerID"
          >
            {{ cust.CustomerName || cust.CustomerID }}
          </option>
        </select>

        <select v-model="selectedCategory" @change="handleCategoryChange">
          <option value="">Choose Category</option>
          <option v-for="cat in configStore.categoryNames" :key="cat" :value="cat">
            {{ cat }}
          </option>
        </select>

        <select v-model="selectedOrganization" @change="handleOrganizationChange">
          <option value="">Choose Organization</option>
          <option v-for="org in configStore.organizations" :key="org.orgid" :value="org.Organization">
            {{ org.Organization }}
          </option>
        </select>

        <select v-model="selectedSite" @change="handleSiteChange">
          <option value="">Choose Site</option>
          <option v-for="site in configStore.sites" :key="site.Site" :value="site.Site">
            {{ site.Site }}
          </option>
        </select>

        <select v-model="selectedAgent" @change="handleAgentChange">
          <option value="">Choose Agent</option>
          <option v-for="agent in configStore.agents" :key="agent.id" :value="agent.Agent">
            {{ agent.Agent }}
          </option>
        </select>

        <button @click="loadData" :disabled="!selectedCategory" class="load-btn">
          Load
        </button>
      </div>
    </div>

    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>

    <div v-if="configStore.loading" class="loading">Loading configurations...</div>
    <div v-else-if="configStore.error" class="error">{{ configStore.error }}</div>

    <div v-else class="config-sections">
      <AddSectionControl
        :custom-sections-allowed="customSectionsAllowed"
        @add-section="handleAddSection"
      />

      <div
        v-for="group in configStore.groupedConfigs"
        :key="group.section"
        class="config-section"
      >
        <div class="section-header" :class="{ collapsed: !isSectionExpanded(group.section) }" @click="toggleSection(group.section)">
          <span class="chevron" :class="{ expanded: isSectionExpanded(group.section) }">&#9658;</span>
          <h2>{{ group.section }}</h2>
          <span v-if="group.sectionToolTip" class="tooltip">{{ group.sectionToolTip }}</span>
        </div>

        <div class="config-items" v-show="isSectionExpanded(group.section)">
          <div v-for="config in group.items" :key="getConfigId(config)" class="config-item">
            <div class="label-cell">
              <span class="property-name">{{ getProperty(config) }}</span>
              <span v-if="getTooltip(config)" class="tooltip" :title="getTooltip(config)">?</span>
            </div>
            <textarea
              v-if="!isPasswordField(config)"
              :value="getValue(config)"
              :placeholder="getPlaceholder(config)"
              @change="updateValue(config, $event.target.value, getCurrentLevel())"
              @input="autoResize($event)"
              :disabled="!canEdit"
              rows="1"
            ></textarea>
            <input
              v-else
              type="password"
              :value="getValue(config)"
              @change="updateValue(config, $event.target.value, getCurrentLevel())"
              :disabled="!canEdit"
            />
            <button v-if="isNonDefaultTask(config)" @click="deleteConfig(getConfigId(config))" class="delete-btn" title="Remove Task">X</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useConfigStore } from '../stores/config';
import AddSectionControl from './AddSectionControl.vue';

const router = useRouter();
const authStore = useAuthStore();
const configStore = useConfigStore();

const selectedCustomer = ref('');
const selectedCategory = ref('');
const selectedOrganization = ref('');
const selectedSite = ref('');
const selectedAgent = ref('');

// Track expanded sections - empty Set means all collapsed by default
const expandedSections = ref(new Set());

function toggleSection(sectionName) {
  if (expandedSections.value.has(sectionName)) {
    expandedSections.value.delete(sectionName);
  } else {
    expandedSections.value.add(sectionName);
  }
  // Trigger reactivity
  expandedSections.value = new Set(expandedSections.value);
}

function isSectionExpanded(sectionName) {
  return expandedSections.value.has(sectionName);
}

const toast = reactive({ show: false, message: '', type: 'info' });

function showToast(message, type = 'info', duration = 3000) {
  toast.show = true;
  toast.message = message;
  toast.type = type;
  setTimeout(() => { toast.show = false; }, duration);
}

const canEdit = computed(() => {
  // Add role check logic here
  return true;
});

// Get the effective customer ID (admin-selected or user's own)
const effectiveCustomerId = computed(() => {
  if (authStore.isAdmin && selectedCustomer.value) {
    return selectedCustomer.value;
  }
  return authStore.user?.customerId;
});

// Helper functions to handle both uppercase and lowercase column names from SQL Server
function getConfigId(config) {
  return config.ID || config.id || config.ConfigID || '';
}

function getProperty(config) {
  return config.property || config.Property || '';
}

function getValue(config) {
  return config.value || config.Value || '';
}

function getTooltip(config) {
  const tip = config.tooltip || config.ToolTip || '';
  return tip === 'No Tip' ? '' : tip;
}

function getPlaceholder(config) {
  return config.placeholder || config.Placeholder || '';
}

function isPasswordField(config) {
  return (config.MVPwdFlag === 'True' || config.MVPwdFlag === true ||
          config.MVPwdFlag2 === '1' || config.MVPwdFlag2 === 1);
}

function isNonDefaultTask(config) {
  return config.NonDefaultTask === 'True' || config.NonDefaultTask === true;
}

function autoResize(event) {
  const textarea = event.target;
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function getCurrentLevel() {
  if (selectedAgent.value) return 'AGENT';
  if (selectedSite.value) return 'SITE';
  if (selectedOrganization.value) return 'ORG';
  return 'CUSTOMER';
}

// Check if current category allows custom sections
const customSectionsAllowed = computed(() => {
  return configStore.selectedCategoryMeta?.custom_sections_allowed ?? false;
});

async function handleAddSection(sectionName) {
  try {
    const result = await configStore.createSection(sectionName);
    if (result?.blocked) {
      showToast('Section creation blocked - database is in read-only mode', 'warning');
    } else if (result?.stub) {
      showToast(`Section "${sectionName}" - ${result.message}`, 'info');
    } else {
      showToast(`Section "${sectionName}" created`, 'info');
    }
  } catch (error) {
    showToast('Failed to create section', 'error');
  }
}

onMounted(async () => {
  // Fetch user roles to determine admin status
  await authStore.fetchUserRoles();

  if (authStore.isAdmin) {
    // Admin users: load customer list and wait for selection
    await configStore.loadCustomers();
  } else if (authStore.user?.customerId) {
    // Normal users: use their associated customerId
    configStore.setSelectedCustomerId(authStore.user.customerId);
    await configStore.loadCategories(authStore.user.customerId);
    await configStore.loadOrganizations(authStore.user.customerId);
  }
});

async function handleCustomerChange() {
  // Reset dependent selections when customer changes
  selectedCategory.value = '';
  selectedOrganization.value = '';
  selectedSite.value = '';
  selectedAgent.value = '';

  if (selectedCustomer.value) {
    configStore.setSelectedCustomerId(selectedCustomer.value);
    await configStore.loadCategories(selectedCustomer.value);
    await configStore.loadOrganizations(selectedCustomer.value);
  }
}

async function handleCategoryChange() {
  configStore.setSelectedCategory(selectedCategory.value);
}

async function handleOrganizationChange() {
  configStore.setSelectedOrganization(selectedOrganization.value);
  if (selectedOrganization.value && effectiveCustomerId.value) {
    await configStore.loadSites(effectiveCustomerId.value, selectedOrganization.value);
  }
}

async function handleSiteChange() {
  configStore.setSelectedSite(selectedSite.value);
  if (selectedSite.value && effectiveCustomerId.value) {
    await configStore.loadAgents(
      effectiveCustomerId.value,
      selectedOrganization.value,
      selectedSite.value
    );
  }
}

async function handleAgentChange() {
  configStore.setSelectedAgent(selectedAgent.value);
}

async function loadData() {
  await configStore.loadConfigs();
}

async function updateValue(config, value, level) {
  try {
    const id = getConfigId(config);
    if (!id) {
      showToast('Cannot update: missing config ID', 'error');
      return;
    }
    const result = await configStore.updateConfig(id, value, level);
    if (result?.blocked) {
      showToast('Edit blocked - database is in read-only mode', 'warning');
    }
  } catch (error) {
    showToast('Failed to update configuration', 'error');
  }
}

async function deleteConfig(configId) {
  if (confirm('Are you sure you want to delete this configuration?')) {
    try {
      const result = await configStore.deleteConfig(configId);
      if (result?.blocked) {
        showToast('Delete blocked - database is in read-only mode', 'warning');
      }
    } catch (error) {
      showToast('Failed to delete configuration', 'error');
    }
  }
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.config-manager {
  min-height: 100vh;
  background: #f5f5f5;
}

header {
  background: #0a5591;
  color: white;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

header h1 {
  margin: 0;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.logout-btn {
  padding: 0.5rem 1rem;
  background: white;
  color: #0a5591;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.filters {
  background: white;
  padding: 1rem 2rem;
  border-bottom: 1px solid #ddd;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1 1 180px;
  min-width: 150px;
}

.customer-select {
  border-color: #0a5591;
  background-color: #f0f7ff;
}

.load-btn {
  padding: 0.5rem 2rem;
  background: linear-gradient(#0dccea, #0d70ea);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  flex: 0 0 auto;
  white-space: nowrap;
}

.load-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading,
.error {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
}

.error {
  color: red;
}

.config-sections {
  padding: 1rem;
  max-width: 1200px;
  margin: 0 auto;
}

@media (min-width: 1400px) {
  .config-sections {
    padding: 1rem 4rem;
  }
}

@media (min-width: 1800px) {
  .config-sections {
    padding: 1rem 8rem;
  }
}

.config-section {
  background: white;
  margin-bottom: 1rem;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-header {
  background: #0a5591;
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 4px 4px 0 0;
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.section-header:hover {
  background: #084470;
}

.chevron {
  font-size: 0.7rem;
  margin-right: 0.5rem;
  transition: transform 0.2s ease;
  display: inline-block;
}

.chevron.expanded {
  transform: rotate(90deg);
}

.section-header.collapsed {
  border-radius: 4px;
}

.section-header h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}

.section-header .tooltip {
  font-size: 0.8rem;
  opacity: 0.8;
  margin-left: 0.5rem;
}

.config-items {
  padding: 0.25rem 0.5rem;
}

.config-item {
  display: grid;
  grid-template-columns: 180px 1fr auto;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid #f0f0f0;
  align-items: start;
  font-size: 0.875rem;
}

.config-item:last-child {
  border-bottom: none;
}

.label-cell {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding-top: 0.3rem;
}

.property-name {
  font-weight: 500;
  color: #333;
}

.config-item .tooltip {
  color: #888;
  cursor: help;
  font-size: 0.75rem;
}

.config-item input,
.config-item textarea {
  padding: 0.3rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 0.875rem;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  font-family: inherit;
}

.config-item textarea {
  resize: none;
  overflow: hidden;
  min-height: 1.75rem;
  line-height: 1.4;
}

.config-item input:focus,
.config-item textarea:focus {
  outline: none;
  border-color: #0a5591;
}

.delete-btn {
  padding: 0.2rem 0.4rem;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #999;
}

.delete-btn:hover {
  color: #c00;
}

.toast {
  position: fixed;
  top: 1rem;
  right: 1rem;
  padding: 0.75rem 1.25rem;
  border-radius: 4px;
  font-size: 0.875rem;
  z-index: 1000;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.toast.info {
  background: #0a5591;
  color: white;
}

.toast.warning {
  background: #f59e0b;
  color: white;
}

.toast.error {
  background: #dc2626;
  color: white;
}

@media (max-width: 600px) {
  .config-item {
    grid-template-columns: 1fr auto;
  }

  .config-item .label-cell {
    grid-column: 1 / -1;
    margin-bottom: 0.25rem;
  }

  .filters {
    padding: 0.75rem 1rem;
  }

  header {
    padding: 0.75rem 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  header h1 {
    font-size: 1.25rem;
  }
}
</style>

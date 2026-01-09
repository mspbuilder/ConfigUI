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
        <select v-model="selectedCategory" @change="handleCategoryChange">
          <option value="">Choose Category</option>
          <option v-for="cat in configStore.categories" :key="cat" :value="cat">
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

    <div v-if="configStore.loading" class="loading">Loading configurations...</div>
    <div v-else-if="configStore.error" class="error">{{ configStore.error }}</div>

    <div v-else class="config-sections">
      <div
        v-for="group in configStore.groupedConfigs"
        :key="group.section"
        class="config-section"
      >
        <div class="section-header">
          <h2>{{ group.section }}</h2>
          <span v-if="group.sectionToolTip" class="tooltip">{{ group.sectionToolTip }}</span>
        </div>

        <div class="config-items">
          <div v-for="config in group.items" :key="getConfigId(config)" class="config-item">
            <div class="config-label">
              <span class="property-name">{{ getProperty(config) }}</span>
              <span v-if="getTooltip(config)" class="tooltip" :title="getTooltip(config)">?</span>
            </div>

            <div class="config-values">
              <div class="value-group">
                <label>Value</label>
                <input
                  v-if="!isPasswordField(config)"
                  type="text"
                  :value="getValue(config)"
                  :placeholder="getPlaceholder(config)"
                  @change="updateValue(config, $event.target.value, getCurrentLevel())"
                  :disabled="!canEdit"
                />
                <input
                  v-else
                  type="password"
                  :value="getValue(config)"
                  @change="updateValue(config, $event.target.value, getCurrentLevel())"
                  :disabled="!canEdit"
                />
              </div>
            </div>

            <div v-if="isNonDefaultTask(config)" class="actions">
              <button @click="deleteConfig(getConfigId(config))" class="delete-btn" title="Remove Task">X</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useConfigStore } from '../stores/config';

const router = useRouter();
const authStore = useAuthStore();
const configStore = useConfigStore();

const selectedCategory = ref('');
const selectedOrganization = ref('');
const selectedSite = ref('');
const selectedAgent = ref('');

const canEdit = computed(() => {
  // Add role check logic here
  return true;
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

function getCurrentLevel() {
  if (selectedAgent.value) return 'AGENT';
  if (selectedSite.value) return 'SITE';
  if (selectedOrganization.value) return 'ORG';
  return 'CUSTOMER';
}

onMounted(async () => {
  if (authStore.user?.customerId) {
    configStore.setSelectedCustomerId(authStore.user.customerId);
    await configStore.loadCategories(authStore.user.customerId);
    await configStore.loadOrganizations(authStore.user.customerId);
  }
});

async function handleCategoryChange() {
  configStore.setSelectedCategory(selectedCategory.value);
}

async function handleOrganizationChange() {
  configStore.setSelectedOrganization(selectedOrganization.value);
  if (selectedOrganization.value) {
    await configStore.loadSites(authStore.user.customerId, selectedOrganization.value);
  }
}

async function handleSiteChange() {
  configStore.setSelectedSite(selectedSite.value);
  if (selectedSite.value) {
    await configStore.loadAgents(
      authStore.user.customerId,
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
    await configStore.updateConfig(config.ConfigID, value, level);
  } catch (error) {
    alert('Failed to update configuration');
  }
}

async function deleteConfig(configId) {
  if (confirm('Are you sure you want to delete this configuration?')) {
    try {
      await configStore.deleteConfig(configId);
    } catch (error) {
      alert('Failed to delete configuration');
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
  gap: 1rem;
  align-items: center;
}

select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1;
}

.load-btn {
  padding: 0.5rem 2rem;
  background: linear-gradient(#0dccea, #0d70ea);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
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
  padding: 2rem;
}

.config-section {
  background: white;
  margin-bottom: 2rem;
  border-radius: 4px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.section-header {
  background: #0a5591;
  color: white;
  padding: 1rem;
  border-radius: 4px 4px 0 0;
}

.section-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.tooltip {
  font-size: 0.9rem;
  opacity: 0.8;
  margin-left: 0.5rem;
}

.config-items {
  padding: 1rem;
}

.config-item {
  display: grid;
  grid-template-columns: 1fr 2fr auto;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid #eee;
  align-items: center;
}

.config-item:last-child {
  border-bottom: none;
}

.property-name {
  font-weight: bold;
}

.config-values {
  display: flex;
  gap: 1rem;
}

.value-group {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.value-group label {
  font-size: 0.8rem;
  color: #666;
}

.value-group input,
.value-group select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.actions {
  display: flex;
  gap: 0.5rem;
}

.delete-btn {
  padding: 0.5rem;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
}

.delete-btn:hover {
  opacity: 0.7;
}
</style>

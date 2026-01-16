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

        <div class="select-wrapper" :class="{ 'has-asterisk-prefix': hasOrgAsterisk() }">
          <select
            v-model="selectedOrganization"
            @change="handleOrganizationChange"
            :disabled="!selectedCategory"
            :class="{ 'select-bold': isSelectedOrgBold() }"
          >
            <option value="">Choose Organization</option>
            <option
              v-for="org in configStore.organizations"
              :key="org.orgid"
              :value="org.orgname"
              :class="getOrgOptionClass(org)"
            >
              {{ formatOrgName(org) }}
            </option>
          </select>
        </div>

        <div class="select-wrapper" :class="{ 'has-asterisk-prefix': hasSiteAsterisk() }">
          <select
            v-model="selectedSite"
            @change="handleSiteChange"
            :disabled="!selectedOrganization"
            :class="{ 'select-bold': isSelectedSiteBold() }"
          >
            <option value="">Choose Site</option>
            <option
              v-for="site in configStore.sites"
              :key="site.site"
              :value="site.site"
              :class="getSiteOptionClass(site)"
            >
              {{ formatSiteName(site) }}
            </option>
          </select>
        </div>

        <div class="select-wrapper">
          <select
            v-model="selectedAgent"
            @change="handleAgentChange"
            :disabled="!selectedSite"
            :class="{ 'select-bold': isSelectedAgentBold() }"
          >
            <option value="">Choose Agent</option>
            <option
              v-for="agent in configStore.agents"
              :key="agent.agent"
              :value="agent.agent"
              :class="getAgentOptionClass(agent)"
            >
              {{ agent.agent }}
            </option>
          </select>
        </div>

        <label class="global-diff-toggle">
          <input type="checkbox" v-model="globalShowDiffOnly" />
          <span>Show differences only</span>
        </label>
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
          <div v-for="config in group.items" :key="getConfigId(config)" class="config-item-wrapper">
            <div class="config-item">
              <div class="label-cell">
                <span class="property-name">{{ getProperty(config) }}</span>
              </div>
              <span v-if="getTooltip(config)" class="tooltip" :title="getTooltip(config)">?</span>
              <span v-else class="tooltip-spacer"></span>
              <!-- Parent Value (inherited from hierarchy) -->
              <div v-if="hasParentValue(config)" class="parent-value-cell" :title="`Overridden from ${getParentLevel(config)}`">
                <span class="parent-label">↑</span>
                <span class="parent-value">{{ getParentValue(config) }}</span>
              </div>
              <div v-else class="parent-value-cell parent-empty"></div>
              <!-- Dropdown for Y/N and other dropdown datatypes -->
              <select
                v-if="isDropdownField(config)"
                :value="getValue(config)"
                @change="updateValue(config, $event.target.value, getCurrentLevel())"
                :disabled="!canEdit"
                class="config-dropdown"
              >
                <option v-for="opt in getDropdownOptions(config)" :key="opt" :value="opt">
                  {{ opt }}
                </option>
              </select>
              <!-- Secure fields (password fields OR Cloud Script Variables) - click to edit -->
              <div
                v-else-if="isSecureField(config)"
                class="secure-field"
                @click="canEdit && openSecureFieldEditor(config)"
                :class="{ disabled: !canEdit, 'has-value': getValue(config) }"
              >
                <span v-if="isPasswordField(config)" class="masked-value">******</span>
                <span v-else class="preview-value">{{ getValue(config) || '(empty)' }}</span>
                <span class="edit-hint" v-if="canEdit">Click to edit</span>
              </div>
              <!-- Default: textarea for text fields -->
              <textarea
                v-else
                :value="getValue(config)"
                :placeholder="getPlaceholder(config)"
                @change="updateValue(config, $event.target.value, getCurrentLevel())"
                @input="autoResize($event)"
                :disabled="!canEdit"
                rows="1"
              ></textarea>
              <!-- Expand button for descendants - inline, right of value -->
              <button
                v-if="hasDescendants(config)"
                @click="toggleDescendants(config)"
                class="expand-btn"
                :title="`${getDescendantsCount(config)} override${getDescendantsCount(config) > 1 ? 's' : ''} below`"
              >
                <span class="expand-icon">{{ isDescendantsExpanded(config) ? '▼' : '▶' }}</span>
                <span class="expand-count">{{ getDescendantsCount(config) }}</span>
              </button>
              <span v-else class="expand-spacer"></span>
              <button v-if="isNonDefaultTask(config)" @click="deleteConfig(getConfigId(config))" class="delete-btn" title="Remove Task">X</button>
            </div>

            <!-- Descendants Table - shown below the row when expanded -->
            <div v-if="hasDescendants(config) && isDescendantsExpanded(config)" class="descendants-table-wrapper">
              <table class="descendants-table">
                <thead>
                  <tr>
                    <th>Level</th>
                    <th>Name</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="descendant in getFilteredDescendants(config)" :key="descendant.id" class="descendant-row">
                    <td class="desc-level">{{ descendant.levelType }}</td>
                    <td class="desc-name">{{ descendant.name || '(unnamed)' }}</td>
                    <td class="desc-value">
                      <span v-if="descendant.Value">{{ descendant.Value }}</span>
                      <span v-else class="inherits">(inherits)</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Secure Field Editor Modal -->
    <SecureFieldEditor
      v-if="secureFieldEditor.visible && secureFieldEditor.config"
      :config-id="getConfigId(secureFieldEditor.config)"
      :property-name="getProperty(secureFieldEditor.config)"
      :initial-value="getValue(secureFieldEditor.config)"
      :initial-security-level="getSecurityLevel(secureFieldEditor.config)"
      :placeholder="getPlaceholder(secureFieldEditor.config)"
      @close="closeSecureFieldEditor"
      @save="handleSecureFieldSave"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useConfigStore } from '../stores/config';
import AddSectionControl from './AddSectionControl.vue';
import SecureFieldEditor from './SecureFieldEditor.vue';
import api from '../services/api';

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

// Track expanded descendants trees
const expandedDescendants = ref(new Set());

// Global "show differences only" toggle - defaults to ON
const globalShowDiffOnly = ref(true);

// Secure field editor state
const secureFieldEditor = reactive({
  visible: false,
  config: null,
});

// Cache for datatype dropdown values (keyed by datatypeid)
const dataTypeValuesCache = ref({});

// Datatypes that use dropdown controls
// 7 = Y/N, 18 = N/Y/All, 19 = dropdown, 25 = dropdown
const DROPDOWN_DATATYPES = [4, 7, 16, 18, 19, 25];

function toggleSection(sectionName) {
  if (expandedSections.value.has(sectionName)) {
    expandedSections.value.delete(sectionName);
  } else {
    expandedSections.value.add(sectionName);
    // Resize textareas after section expands and DOM updates
    resizeAllTextareas();
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

function getParentValue(config) {
  return config.ParentValue || config.parentvalue || '';
}

function getParentLevel(config) {
  const level = config.ParentLevel ?? config.parentlevel;

  if (level === null || level === undefined) {
    return 'Unknown';
  }

  // _cfg_level mapping: -1=Global, 0=Customer, 1=Org, 2=Site, 3=Agent
  const levelMap = {
    '-1': 'Global',
    '0': 'Customer',
    '1': 'Organization',
    '2': 'Site',
    '3': 'Agent'
  };

  return levelMap[level] || `Level ${level}`;
}

function hasParentValue(config) {
  const parentVal = getParentValue(config);
  return parentVal !== null && parentVal !== undefined && parentVal !== '';
}

// Descendants helper functions
function getDescendants(config) {
  const json = config.DescendantsJson || config.descendantsjson;
  if (!json) return [];

  try {
    return typeof json === 'string' ? JSON.parse(json) : json;
  } catch (e) {
    console.error('Failed to parse DescendantsJson:', e);
    return [];
  }
}

function hasDescendants(config) {
  const descendants = getDescendants(config);
  return descendants.length > 0;
}

function getDescendantsCount(config) {
  return getDescendants(config).length;
}

function toggleDescendants(config) {
  const configId = getConfigId(config);
  if (expandedDescendants.value.has(configId)) {
    expandedDescendants.value.delete(configId);
  } else {
    expandedDescendants.value.add(configId);
  }
  expandedDescendants.value = new Set(expandedDescendants.value);
}

function isDescendantsExpanded(config) {
  return expandedDescendants.value.has(getConfigId(config));
}

function getFilteredDescendants(config) {
  const descendants = getDescendants(config);

  // Use global toggle (defaults to ON)
  if (!globalShowDiffOnly.value) {
    return descendants;
  }

  // Filter to show only descendants where value differs from parent
  const currentValue = getValue(config);
  const filtered = [];

  for (let i = 0; i < descendants.length; i++) {
    const descendant = descendants[i];

    // Determine this descendant's parent value
    // If this is the first descendant, parent is the current config
    // Otherwise, parent is the previous descendant with lower level
    let parentValue = currentValue;

    if (i > 0) {
      // Find the immediate parent (closest lower level)
      for (let j = i - 1; j >= 0; j--) {
        if (descendants[j].level < descendant.level) {
          parentValue = descendants[j].Value || parentValue;
          break;
        }
      }
    }

    // Show if descendant value differs from parent
    const descendantValue = descendant.Value || '';
    if (descendantValue !== parentValue) {
      filtered.push(descendant);
    }
  }

  return filtered;
}

function isPasswordField(config) {
  return (config.MVPwdFlag === 'True' || config.MVPwdFlag === true ||
          config.MVPwdFlag2 === '1' || config.MVPwdFlag2 === 1);
}

// Check if this is a Cloud Script Variable (VARMAP section) - these use the secure field editor
function isCloudScriptVariable(config) {
  const section = (config.section || config.Section || '').toUpperCase();
  return section === 'VARMAP';
}

// Check if config should use secure field editor (either password field OR cloud script variable)
function isSecureField(config) {
  return isPasswordField(config) || isCloudScriptVariable(config);
}

function getSecurityLevel(config) {
  if (config.MVPwdFlag === 'True' || config.MVPwdFlag === true) {
    return 'password';
  }
  if (config.MVPwdFlag2 === '1' || config.MVPwdFlag2 === 1) {
    return 'secure';
  }
  return 'plain';
}

function openSecureFieldEditor(config) {
  secureFieldEditor.config = config;
  secureFieldEditor.visible = true;
}

function closeSecureFieldEditor() {
  secureFieldEditor.visible = false;
  secureFieldEditor.config = null;
}

async function handleSecureFieldSave({ configId, value, securityLevel }) {
  try {
    // TODO: Add encryption based on securityLevel when DiCipher is implemented
    // For now, pass the security level to the backend
    const result = await configStore.updateConfig(configId, value, getCurrentLevel(), securityLevel);
    if (result?.blocked) {
      showToast('Edit blocked - database is in read-only mode', 'warning');
    } else {
      showToast('Secure field updated', 'info');
    }
    closeSecureFieldEditor();
  } catch (error) {
    showToast('Failed to update secure field', 'error');
  }
}

function isNonDefaultTask(config) {
  return config.NonDefaultTask === 'True' || config.NonDefaultTask === true;
}

function getDataTypeId(config) {
  return config.datatypeid || config.DataTypeID || config.dataTypeId || null;
}

function isDropdownField(config) {
  const dtId = getDataTypeId(config);
  return dtId && DROPDOWN_DATATYPES.includes(parseInt(dtId));
}

function getDropdownOptions(config) {
  const dtId = getDataTypeId(config);
  if (!dtId) return [];
  return dataTypeValuesCache.value[dtId] || [];
}

async function loadDataTypeValues(dataTypeId) {
  if (dataTypeValuesCache.value[dataTypeId]) return;
  try {
    const response = await api.getDataTypeValues(dataTypeId);
    if (response.data.success && response.data.values) {
      // Store the DATA column values from the SP result
      dataTypeValuesCache.value[dataTypeId] = response.data.values.map(v => v.DATA || v.data || v);
    }
  } catch (error) {
    console.error('Failed to load datatype values:', error);
  }
}

async function loadAllDataTypeValues() {
  // Load dropdown values for all dropdown datatypes used in current configs
  const uniqueDataTypes = new Set();
  configStore.configs.forEach(config => {
    const dtId = getDataTypeId(config);
    if (dtId && DROPDOWN_DATATYPES.includes(parseInt(dtId))) {
      uniqueDataTypes.add(parseInt(dtId));
    }
  });

  await Promise.all([...uniqueDataTypes].map(dtId => loadDataTypeValues(dtId)));
}

function autoResize(event) {
  const textarea = event.target;
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}

function resizeAllTextareas() {
  nextTick(() => {
    const textareas = document.querySelectorAll('.config-item textarea');
    textareas.forEach(textarea => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    });
  });
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
    // Organizations will load after category is selected
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
    // Organizations will load after category is selected
  }
}

async function handleCategoryChange() {
  // Reset dependent selections when category changes
  selectedOrganization.value = '';
  selectedSite.value = '';
  selectedAgent.value = '';

  configStore.setSelectedCategory(selectedCategory.value);

  // Reload organizations with the new category (required for override flags)
  if (selectedCategory.value && effectiveCustomerId.value) {
    await configStore.loadOrganizations(effectiveCustomerId.value, selectedCategory.value);
    // Auto-load configs when category is selected
    await loadData();
  }
}

async function handleOrganizationChange() {
  // Reset dependent selections when organization changes
  selectedSite.value = '';
  selectedAgent.value = '';

  configStore.setSelectedOrganization(selectedOrganization.value);

  // Reload sites with the new organization (required for override flags)
  if (selectedOrganization.value && effectiveCustomerId.value && selectedCategory.value) {
    await configStore.loadSites(effectiveCustomerId.value, selectedOrganization.value, selectedCategory.value);
  }
  // Auto-load configs when organization changes
  if (selectedCategory.value) {
    await loadData();
  }
}

async function handleSiteChange() {
  // Reset dependent selections when site changes
  selectedAgent.value = '';

  configStore.setSelectedSite(selectedSite.value);

  // Reload agents with the new site (required for override flags)
  if (selectedSite.value && effectiveCustomerId.value && selectedCategory.value) {
    await configStore.loadAgents(
      effectiveCustomerId.value,
      selectedOrganization.value,
      selectedSite.value,
      selectedCategory.value
    );
  }
  // Auto-load configs when site changes
  if (selectedCategory.value) {
    await loadData();
  }
}

async function handleAgentChange() {
  configStore.setSelectedAgent(selectedAgent.value);
  // Auto-load configs when agent changes
  if (selectedCategory.value) {
    await loadData();
  }
}

async function loadData() {
  await configStore.loadConfigs();
  await loadAllDataTypeValues();
  resizeAllTextareas();
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

// Format organization name with asterisk if overridden below
function formatOrgName(org) {
  const overridenBelow = org.flag_overriden_below === true || org.flag_overriden_below === 1;
  return overridenBelow ? `* ${org.orgname}` : org.orgname;
}

// Get CSS class for organization option based on override flags
function getOrgOptionClass(org) {
  const overridenHere = org.flag_overriden_here === true || org.flag_overriden_here === 1;
  return overridenHere ? 'org-overridden-here' : '';
}

// Format site name with asterisk if overridden below
function formatSiteName(site) {
  const overridenBelow = site.flag_overriden_below === true || site.flag_overriden_below === 1;
  return overridenBelow ? `* ${site.site}` : site.site;
}

// Get CSS class for site option based on override flags
function getSiteOptionClass(site) {
  const overridenHere = site.flag_overriden_here === true || site.flag_overriden_here === 1;
  return overridenHere ? 'site-overridden-here' : '';
}

// Get CSS class for agent option based on override flag (agents have no children)
function getAgentOptionClass(agent) {
  const overridenHere = agent.flag_overriden_here === true || agent.flag_overriden_here === 1;
  return overridenHere ? 'agent-overridden-here' : '';
}

// Display formatters for selected values (closed dropdown)
const displayedOrganization = computed(() => {
  if (!selectedOrganization.value) return '';
  const org = configStore.organizations.find(o => o.orgname === selectedOrganization.value);
  return org ? formatOrgName(org) : selectedOrganization.value;
});

const displayedSite = computed(() => {
  if (!selectedSite.value) return '';
  const site = configStore.sites.find(s => s.site === selectedSite.value);
  return site ? formatSiteName(site) : selectedSite.value;
});

const displayedAgent = computed(() => {
  if (!selectedAgent.value) return '';
  return selectedAgent.value; // Agents don't have asterisk prefix (no children)
});

// Check if selected item has bold styling
function isSelectedOrgBold() {
  if (!selectedOrganization.value) return false;
  const org = configStore.organizations.find(o => o.orgname === selectedOrganization.value);
  return org ? (org.flag_overriden_here === true || org.flag_overriden_here === 1) : false;
}

function isSelectedSiteBold() {
  if (!selectedSite.value) return false;
  const site = configStore.sites.find(s => s.site === selectedSite.value);
  return site ? (site.flag_overriden_here === true || site.flag_overriden_here === 1) : false;
}

function isSelectedAgentBold() {
  if (!selectedAgent.value) return false;
  const agent = configStore.agents.find(a => a.agent === selectedAgent.value);
  return agent ? (agent.flag_overriden_here === true || agent.flag_overriden_here === 1) : false;
}

// Check if selected item should show asterisk prefix
function hasOrgAsterisk() {
  if (!selectedOrganization.value) return false;
  const org = configStore.organizations.find(o => o.orgname === selectedOrganization.value);
  return org ? (org.flag_overriden_below === true || org.flag_overriden_below === 1) : false;
}

function hasSiteAsterisk() {
  if (!selectedSite.value) return false;
  const site = configStore.sites.find(s => s.site === selectedSite.value);
  return site ? (site.flag_overriden_below === true || site.flag_overriden_below === 1) : false;
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

/* Select wrapper for asterisk prefix */
.select-wrapper {
  position: relative;
  flex: 1 1 180px;
  min-width: 150px;
}

.select-wrapper select {
  width: 100%;
}

/* Add asterisk prefix to closed select when flag_overriden_below is true */
.select-wrapper.has-asterisk-prefix select:not(:focus) {
  padding-left: 1.5rem;
}

.select-wrapper.has-asterisk-prefix::before {
  content: '*';
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  color: inherit;
  z-index: 1;
  font-size: 1rem;
}

/* Hide asterisk when dropdown is open (focused) */
.select-wrapper.has-asterisk-prefix select:focus::before {
  content: none;
}

select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  flex: 1 1 180px;
  min-width: 150px;
}

select option.org-overridden-here,
select option.site-overridden-here,
select option.agent-overridden-here {
  font-weight: bold;
}

/* Apply bold to select when a bold option is selected */
select.select-bold {
  font-weight: bold;
}

.customer-select {
  border-color: #0a5591;
  background-color: #f0f7ff;
}

.global-diff-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.875rem;
  color: #333;
  cursor: pointer;
  user-select: none;
  padding: 0.5rem 0.75rem;
  background: #f0f7ff;
  border: 1px solid #d0e7ff;
  border-radius: 4px;
  white-space: nowrap;
}

.global-diff-toggle:hover {
  background: #e0efff;
}

.global-diff-toggle input[type="checkbox"] {
  cursor: pointer;
  width: 14px;
  height: 14px;
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

.config-item-wrapper {
  border-bottom: 1px solid #f0f0f0;
}

.config-item-wrapper:last-child {
  border-bottom: none;
}

.config-item {
  display: grid;
  grid-template-columns: 180px auto 200px 1fr auto auto;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem;
  align-items: start;
  font-size: 0.875rem;
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

.config-item .tooltip,
.config-item .tooltip-spacer {
  width: 1rem;
  text-align: center;
  padding-top: 0.3rem;
}

.config-item .tooltip {
  color: #888;
  cursor: help;
  font-size: 0.75rem;
}

.parent-value-cell {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem 0.5rem;
  background: #f0f7ff;
  border: 1px solid #d0e7ff;
  border-radius: 3px;
  font-size: 0.875rem;
  min-height: 1.75rem;
  box-sizing: border-box;
}

.parent-value-cell.parent-empty {
  background: transparent;
  border: 1px solid transparent;
}

.parent-label {
  color: #0a5591;
  font-weight: bold;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.parent-value {
  color: #555;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-style: italic;
}


.config-item .secure-field {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.3rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 3px;
  background: #f8f8f8;
  cursor: pointer;
  min-height: 1.75rem;
  box-sizing: border-box;
}

.config-item .secure-field:hover:not(.disabled) {
  border-color: #0a5591;
  background: #f0f7ff;
}

.config-item .secure-field.disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.config-item .secure-field .masked-value {
  color: #666;
  font-family: monospace;
  letter-spacing: 0.1em;
}

.config-item .secure-field .preview-value {
  color: #333;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 300px;
}

.config-item .secure-field:not(.has-value) .preview-value {
  color: #999;
  font-style: italic;
}

.config-item .secure-field .edit-hint {
  font-size: 0.75rem;
  color: #0a5591;
  margin-left: auto;
  flex-shrink: 0;
}

.config-item input,
.config-item textarea,
.config-item .config-dropdown {
  padding: 0.3rem 0.5rem;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 0.875rem;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  font-family: inherit;
}

.config-item .config-dropdown {
  width: auto;
  min-width: 70px;
  max-width: 200px;
  flex-shrink: 0;
  background-color: white;
  cursor: pointer;
  color: #0a5591;
  font-weight: 500;
}

.config-item textarea {
  resize: none;
  overflow: hidden;
  min-height: 1.75rem;
  line-height: 1.4;
}

.config-item input:focus,
.config-item textarea:focus,
.config-item .config-dropdown:focus {
  outline: none;
  border-color: #0a5591;
}

.expand-btn {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  background: #f0f7ff;
  border: 1px solid #d0e7ff;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8rem;
  color: #0a5591;
  white-space: nowrap;
}

.expand-btn:hover {
  background: #e0efff;
  border-color: #0a5591;
}

.expand-icon {
  font-size: 0.7rem;
}

.expand-count {
  font-weight: 600;
}

.expand-spacer {
  width: 2.5rem;
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

/* Descendants Table */
.descendants-table-wrapper {
  margin: 0.25rem 0 0.5rem 180px;
  padding: 0.5rem;
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.descendants-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.descendants-table th {
  text-align: left;
  padding: 0.4rem 0.75rem;
  background: #e8f4f8;
  border-bottom: 1px solid #d0e7ff;
  color: #0a5591;
  font-weight: 600;
  font-size: 0.8rem;
}

.descendants-table td {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid #f0f0f0;
}

.descendants-table tr:last-child td {
  border-bottom: none;
}

.descendant-row:hover {
  background: #f0f7ff;
}

.desc-level {
  color: #666;
  font-weight: 500;
  width: 100px;
}

.desc-name {
  color: #333;
  font-weight: 500;
}

.desc-value {
  color: #0a5591;
  font-family: monospace;
  font-size: 0.85rem;
}

.desc-value .inherits {
  color: #999;
  font-style: italic;
  font-family: inherit;
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
    grid-template-columns: auto 1fr auto auto;
  }

  .config-item .label-cell {
    grid-column: 1 / -1;
    margin-bottom: 0.25rem;
  }

  .config-item .tooltip,
  .config-item .tooltip-spacer,
  .config-item .parent-value-cell {
    display: none;
  }

  .descendants-table-wrapper {
    margin-left: 0;
  }

  .global-diff-toggle {
    flex: 1 1 100%;
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

<template>
  <div v-if="visible" class="add-rmuoba-control">
    <button @click="toggleForm" class="add-rmuoba-btn">
      + RMUOBA - Agent Onboarding: New Section
    </button>

    <div v-if="showForm" class="add-rmuoba-form">
      <!-- Step 1: Choose update type -->
      <div class="form-section">
        <div class="section-title">Choose Type of Update</div>
        <div class="type-buttons">
          <button
            v-for="type in updateTypes"
            :key="type.value"
            @click="selectUpdateType(type)"
            :class="['type-btn', { selected: selectedType?.value === type.value }]"
          >
            {{ type.label }}
          </button>
        </div>
      </div>

      <!-- Step 2: Data entry based on type -->
      <div v-if="selectedType" class="form-section">
        <div class="section-title">{{ selectedType.label }} Entry</div>

        <!-- Org-based types need organization selection -->
        <div v-if="selectedType.needsOrg" class="form-row">
          <label>
            <span>Organization</span>
            <select v-model="selectedOrg" class="rmuoba-select" @change="handleOrgChange">
              <option value="">Choose Organization</option>
              <option v-for="org in organizations" :key="org.orgid" :value="org.orgcode">
                {{ org.orgname }}
              </option>
            </select>
          </label>
        </div>

        <!-- Org-wkstns.site type also needs site selection -->
        <div v-if="selectedType.needsSite" class="form-row">
          <label>
            <span>Site</span>
            <select v-model="selectedSite" class="rmuoba-select" :disabled="!selectedOrg">
              <option value="">{{ selectedOrg ? 'Choose Site' : 'Choose Organization First' }}</option>
              <option v-for="site in sites" :key="site.site" :value="site.site">
                {{ site.site }}
              </option>
            </select>
          </label>
        </div>

        <!-- Procedure/Property name -->
        <div class="form-row">
          <label>
            <span>{{ selectedType.needsOrg ? 'Procedure Name' : 'Property' }}</span>
            <input
              v-model="procedureName"
              type="text"
              placeholder=""
              class="rmuoba-input"
            />
          </label>
        </div>

        <!-- Y/N dropdown (for most types) or Value input (for EXCLUDE types) -->
        <div class="form-row">
          <label>
            <span>Value</span>
            <select v-if="!selectedType.needsTextValue" v-model="yesNoValue" class="rmuoba-select">
              <option value="Y">Y</option>
              <option value="N">N</option>
            </select>
            <input
              v-else
              v-model="textValue"
              type="text"
              placeholder=""
              class="rmuoba-input"
            />
          </label>
        </div>

        <div class="form-actions">
          <button @click="handleAdd" :disabled="!isValid" class="confirm-btn">
            Add Entry
          </button>
          <button @click="cancelAdd" class="cancel-btn">
            Cancel
          </button>
        </div>

        <div v-if="errorMessage" class="error-message">
          {{ errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useConfigStore } from '../stores/config';

const props = defineProps({
  categoryName: {
    type: String,
    default: ''
  },
  customSectionsAllowed: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['add-section', 'add-entry']);

const configStore = useConfigStore();

const showForm = ref(false);
const selectedType = ref(null);
const selectedOrg = ref('');
const selectedSite = ref('');
const procedureName = ref('');
const yesNoValue = ref('Y');
const textValue = ref('');
const errorMessage = ref('');

// Update types available for RMUOBA
const updateTypes = [
  { value: 'ALL', label: 'ALL', needsOrg: false, needsSite: false, needsTextValue: false, updateTypeParam: 'ALL' },
  { value: 'ALL-WKSTNS', label: 'ALL-WKSTNS', needsOrg: false, needsSite: false, needsTextValue: false, updateTypeParam: 'ALL-WKSTNS' },
  { value: 'ALL-SERVERS', label: 'ALL-SERVERS', needsOrg: false, needsSite: false, needsTextValue: false, updateTypeParam: 'ALL-SERVERS' },
  { value: 'ALL_EXCLUDE', label: 'ALL_EXCLUDE', needsOrg: false, needsSite: false, needsTextValue: true, updateTypeParam: 'ALL_EXCLUDE' },
  { value: 'ALL-WKSTNS_EXCLUDE', label: 'ALL-WKSTNS_EXCLUDE', needsOrg: false, needsSite: false, needsTextValue: true, updateTypeParam: 'ALL-WKSTNS_EXCLUDE' },
  { value: 'ALL-SERVERS_EXCLUDE', label: 'ALL-SERVERS_EXCLUDE', needsOrg: false, needsSite: false, needsTextValue: true, updateTypeParam: 'ALL-SERVERS_EXCLUDE' },
  { value: 'Org-all', label: 'Org-all', needsOrg: true, needsSite: false, needsTextValue: false, updateTypeParam: '-all' },
  { value: 'Org-wkstns', label: 'Org-wkstns', needsOrg: true, needsSite: false, needsTextValue: false, updateTypeParam: '-wkstns' },
  { value: 'Org-wkstns.site', label: 'Org-wkstns.site', needsOrg: true, needsSite: true, needsTextValue: false, updateTypeParam: '-wkstns.' },
  { value: 'Org-servers', label: 'Org-servers', needsOrg: true, needsSite: false, needsTextValue: false, updateTypeParam: '-servers' }
];

const visible = computed(() => {
  const isRMUOBA = props.categoryName === 'RMUOBA - Agent Onboarding';
  return isRMUOBA && props.customSectionsAllowed;
});

const organizations = computed(() => configStore.organizations || []);
const sites = computed(() => configStore.sites || []);

const isValid = computed(() => {
  if (!selectedType.value) return false;
  if (!procedureName.value.trim()) return false;

  if (selectedType.value.needsOrg && !selectedOrg.value) return false;
  if (selectedType.value.needsSite && !selectedSite.value) return false;
  if (selectedType.value.needsTextValue && !textValue.value.trim()) return false;

  return true;
});

function toggleForm() {
  showForm.value = !showForm.value;
  if (!showForm.value) {
    resetForm();
  }
}

function resetForm() {
  selectedType.value = null;
  selectedOrg.value = '';
  selectedSite.value = '';
  procedureName.value = '';
  yesNoValue.value = 'Y';
  textValue.value = '';
  errorMessage.value = '';
}

function selectUpdateType(type) {
  selectedType.value = type;
  selectedOrg.value = '';
  selectedSite.value = '';
  procedureName.value = '';
  yesNoValue.value = 'Y';
  textValue.value = '';
  errorMessage.value = '';
}

async function handleOrgChange() {
  selectedSite.value = '';
  // Sites are already loaded from the main ConfigManager when category is selected
}

function handleAdd() {
  if (!isValid.value) {
    errorMessage.value = 'Please fill in all required fields';
    return;
  }

  const value = selectedType.value.needsTextValue ? textValue.value.trim() : yesNoValue.value;

  if (selectedType.value.needsOrg) {
    // Org-based types use ADD_NEW_RMUOBA_SECTION
    emit('add-section', {
      updateType: selectedType.value.updateTypeParam,
      organization: selectedOrg.value,
      procedureName: procedureName.value.trim(),
      yesNo: value,
      site: selectedType.value.needsSite ? selectedSite.value : ''
    });
  } else {
    // ALL-based types use ADD_NEW_RMUOBA_ENTRY
    emit('add-entry', {
      updateType: selectedType.value.updateTypeParam,
      property: procedureName.value.trim(),
      value: value
    });
  }

  resetForm();
  showForm.value = false;
}

function cancelAdd() {
  resetForm();
  showForm.value = false;
}
</script>

<style scoped>
.add-rmuoba-control {
  margin: 1rem 0;
}

.add-rmuoba-btn {
  padding: 0.5rem 1rem;
  background: #0a5591;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.add-rmuoba-btn:hover {
  background: #084470;
}

.add-rmuoba-form {
  margin-top: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  max-width: 600px;
}

.form-section {
  margin-bottom: 1rem;
}

.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0a5591;
  margin-bottom: 0.5rem;
  padding-bottom: 0.25rem;
  border-bottom: 1px solid #e0e0e0;
}

.type-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.type-btn {
  padding: 0.4rem 0.75rem;
  background: #f0f0f0;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
}

.type-btn:hover {
  background: #e0efff;
  border-color: #0a5591;
}

.type-btn.selected {
  background: #0a5591;
  color: white;
  border-color: #0a5591;
}

.form-row {
  margin-bottom: 0.75rem;
}

.form-row label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.form-row label span {
  font-size: 0.875rem;
  font-weight: 500;
  color: #333;
}

.rmuoba-input,
.rmuoba-select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  box-sizing: border-box;
}

.rmuoba-input:focus,
.rmuoba-select:focus {
  outline: none;
  border-color: #0a5591;
}

.rmuoba-select:disabled {
  background: #f5f5f5;
  color: #999;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
}

.confirm-btn {
  padding: 0.4rem 1rem;
  background: #0a5591;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.confirm-btn:not(:disabled):hover {
  background: #084470;
}

.cancel-btn {
  padding: 0.4rem 1rem;
  background: #e5e5e5;
  color: #333;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #d5d5d5;
}

.error-message {
  margin-top: 0.75rem;
  padding: 0.5rem;
  background: #fee2e2;
  color: #dc2626;
  border-radius: 4px;
  font-size: 0.875rem;
}
</style>

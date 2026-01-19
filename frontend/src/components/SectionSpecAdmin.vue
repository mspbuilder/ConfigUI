<template>
  <div class="section-spec-admin">
    <header>
      <h1>Admin: Section Specifications</h1>
      <div class="user-info">
        <router-link to="/admin/file-specs" class="nav-link">File Specs</router-link>
        <router-link to="/" class="back-link">Back to Config Manager</router-link>
        <span>{{ authStore.user?.username }}</span>
        <button @click="handleLogout" class="logout-btn">Logout</button>
      </div>
    </header>

    <div v-if="toast.show" class="toast" :class="toast.type">
      {{ toast.message }}
    </div>

    <div class="content">
      <div v-if="!authStore.isAdmin" class="access-denied">
        <h2>Access Denied</h2>
        <p>You must be an administrator to access this page.</p>
        <router-link to="/">Return to Config Manager</router-link>
      </div>

      <div v-else>
        <div class="filter-section">
          <label for="file-select">Filter by file_desc:</label>
          <select id="file-select" v-model="selectedFileSpecId" @change="handleFileChange">
            <option value="">-- Select a File --</option>
            <option
              v-for="fs in sectionSpecStore.fileSpecOptions"
              :key="fs.id"
              :value="fs.id"
            >
              {{ fs.desc }}
            </option>
          </select>
        </div>

        <div v-if="!selectedFileSpecId" class="no-selection">
          <p>Please select a file to view its section specifications.</p>
        </div>

        <div v-else-if="sectionSpecStore.loading" class="loading">
          Loading section specifications...
        </div>

        <div v-else-if="sectionSpecStore.error" class="error">
          {{ sectionSpecStore.error }}
        </div>

        <div v-else-if="sectionSpecStore.sectionSpecs.length === 0" class="no-data">
          <p>No section specifications found for this file.</p>
        </div>

        <div v-else class="section-spec-table-container">
          <p class="table-description">
            Manage section specifications for <strong>{{ currentFileDesc }}</strong>.
            Editable fields are highlighted.
          </p>

          <table class="section-spec-table">
            <thead>
              <tr>
                <th class="col-id">section_spec_id</th>
                <th class="col-name">section_name</th>
                <th class="col-desc">section_desc</th>
                <th class="col-sort">sort_order</th>
                <th class="col-bool">is_global_default</th>
                <th class="col-bool">is_optional</th>
                <th class="col-bool">presense_enforced</th>
                <th class="col-date">last_reviewed</th>
                <th class="col-user">updated_by</th>
                <th class="col-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="spec in sectionSpecStore.sortedSectionSpecs" :key="spec.section_spec_id">
                <td class="col-id">{{ spec.section_spec_id }}</td>
                <td class="col-name editable">
                  <input
                    type="text"
                    v-model="editState[spec.section_spec_id].section_name"
                    @change="markDirty(spec.section_spec_id)"
                    maxlength="150"
                  />
                </td>
                <td class="col-desc editable">
                  <input
                    type="text"
                    v-model="editState[spec.section_spec_id].section_desc"
                    @change="markDirty(spec.section_spec_id)"
                    maxlength="250"
                    placeholder="Enter description..."
                  />
                </td>
                <td class="col-sort editable">
                  <input
                    type="number"
                    v-model.number="editState[spec.section_spec_id].sort_order"
                    @change="markDirty(spec.section_spec_id)"
                    min="0"
                  />
                </td>
                <td class="col-bool editable">
                  <input
                    type="checkbox"
                    v-model="editState[spec.section_spec_id].is_global_default"
                    @change="markDirty(spec.section_spec_id)"
                  />
                </td>
                <td class="col-bool editable">
                  <input
                    type="checkbox"
                    v-model="editState[spec.section_spec_id].is_optional"
                    @change="markDirty(spec.section_spec_id)"
                  />
                </td>
                <td class="col-bool editable">
                  <input
                    type="checkbox"
                    v-model="editState[spec.section_spec_id].presense_enforced"
                    @change="markDirty(spec.section_spec_id)"
                  />
                </td>
                <td class="col-date">{{ formatDate(spec.last_reviewed) }}</td>
                <td class="col-user">{{ spec.updated_by || '-' }}</td>
                <td class="col-actions">
                  <button
                    v-if="isDirty(spec.section_spec_id)"
                    @click="saveSpec(spec.section_spec_id)"
                    class="save-btn"
                    :disabled="saving[spec.section_spec_id]"
                  >
                    {{ saving[spec.section_spec_id] ? 'Saving...' : 'Save' }}
                  </button>
                  <button
                    v-if="isDirty(spec.section_spec_id)"
                    @click="resetSpec(spec.section_spec_id)"
                    class="cancel-btn"
                    :disabled="saving[spec.section_spec_id]"
                  >
                    Cancel
                  </button>
                  <span v-if="!isDirty(spec.section_spec_id)" class="no-changes">-</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useSectionSpecStore } from '../stores/sectionSpec';

const router = useRouter();
const authStore = useAuthStore();
const sectionSpecStore = useSectionSpecStore();

const selectedFileSpecId = ref('');
const toast = reactive({ show: false, message: '', type: 'success' });
const editState = reactive({});
const originalState = reactive({});
const saving = reactive({});

const currentFileDesc = computed(() => {
  const fs = sectionSpecStore.fileSpecOptions.find(f => f.id === parseInt(selectedFileSpecId.value));
  return fs ? fs.desc : '';
});

function showToast(message, type = 'success') {
  toast.message = message;
  toast.type = type;
  toast.show = true;
  setTimeout(() => { toast.show = false; }, 3000);
}

function formatDate(dateString) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function initEditState() {
  // Clear existing state
  Object.keys(editState).forEach(key => delete editState[key]);
  Object.keys(originalState).forEach(key => delete originalState[key]);
  Object.keys(saving).forEach(key => delete saving[key]);

  sectionSpecStore.sectionSpecs.forEach(spec => {
    editState[spec.section_spec_id] = {
      section_name: spec.section_name || '',
      section_desc: spec.section_desc || '',
      sort_order: spec.sort_order,
      is_global_default: spec.is_global_default || false,
      is_optional: spec.is_optional || false,
      presense_enforced: spec.presense_enforced || false
    };
    originalState[spec.section_spec_id] = { ...editState[spec.section_spec_id] };
    saving[spec.section_spec_id] = false;
  });
}

function markDirty(id) {
  // Triggers reactivity - isDirty will re-compute
}

function isDirty(id) {
  const edit = editState[id];
  const orig = originalState[id];
  if (!edit || !orig) return false;

  return edit.section_name !== orig.section_name ||
         edit.section_desc !== orig.section_desc ||
         edit.sort_order !== orig.sort_order ||
         edit.is_global_default !== orig.is_global_default ||
         edit.is_optional !== orig.is_optional ||
         edit.presense_enforced !== orig.presense_enforced;
}

function resetSpec(id) {
  const orig = originalState[id];
  if (orig) {
    editState[id] = { ...orig };
  }
}

async function saveSpec(id) {
  const edit = editState[id];
  if (!edit.section_name || !edit.section_name.trim()) {
    showToast('section_name is required', 'error');
    return;
  }

  saving[id] = true;
  try {
    const result = await sectionSpecStore.updateSectionSpec(id, edit);

    if (result?.blocked) {
      showToast('Update blocked - database is in read-only mode', 'warning');
    } else {
      showToast('Section specification updated', 'success');
      originalState[id] = { ...editState[id] };
    }
  } catch (error) {
    showToast('Failed to update section specification', 'error');
  } finally {
    saving[id] = false;
  }
}

async function handleFileChange() {
  if (selectedFileSpecId.value) {
    await sectionSpecStore.loadSectionSpecs(selectedFileSpecId.value);
    initEditState();
  }
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

// Watch for sectionSpecs changes to reinitialize edit state
watch(() => sectionSpecStore.sectionSpecs, () => {
  initEditState();
}, { deep: true });

onMounted(async () => {
  await authStore.fetchUserRoles();

  if (authStore.isAdmin) {
    await sectionSpecStore.loadFileSpecs();
  }
});
</script>

<style scoped>
.section-spec-admin {
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
  font-size: 1.5rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.back-link,
.nav-link {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.back-link:hover,
.nav-link:hover {
  background: rgba(255, 255, 255, 0.25);
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

.logout-btn:hover {
  background: #e0e0e0;
}

.content {
  padding: 1.5rem 2rem;
  max-width: 1600px;
  margin: 0 auto;
}

.filter-section {
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.filter-section label {
  font-weight: 500;
  color: #333;
}

.filter-section select {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.95rem;
  min-width: 300px;
}

.filter-section select:focus {
  outline: none;
  border-color: #0a5591;
}

.access-denied {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.access-denied h2 {
  color: #c00;
  margin-top: 0;
}

.access-denied a {
  color: #0a5591;
}

.no-selection,
.no-data {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  text-align: center;
  color: #666;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

.table-description {
  margin-bottom: 1rem;
  color: #666;
}

.section-spec-table-container {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

.section-spec-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.section-spec-table th,
.section-spec-table td {
  padding: 0.75rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.section-spec-table th {
  background: #f8f8f8;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}

.section-spec-table tbody tr:hover {
  background: #fafafa;
}

.col-id {
  width: 50px;
  text-align: center;
}

.col-name {
  min-width: 180px;
}

.col-desc {
  min-width: 200px;
}

.col-sort {
  width: 80px;
  text-align: center;
}

.col-bool {
  width: 80px;
  text-align: center;
}

.col-date {
  width: 150px;
  color: #666;
  font-size: 0.85em;
}

.col-user {
  width: 120px;
  color: #666;
  font-size: 0.85em;
}

.col-actions {
  width: 140px;
  text-align: center;
}

/* Editable cells styling */
.editable {
  background: #fffef0;
}

.editable input[type="text"] {
  width: 100%;
  padding: 0.4rem;
  border: 1px solid #ddd;
  border-radius: 3px;
  font-size: 0.9rem;
}

.editable input[type="text"]:focus {
  outline: none;
  border-color: #0a5591;
  box-shadow: 0 0 0 2px rgba(10, 85, 145, 0.1);
}

.editable input[type="number"] {
  width: 60px;
  padding: 0.4rem;
  border: 1px solid #ddd;
  border-radius: 3px;
  text-align: center;
}

.editable input[type="number"]:focus {
  outline: none;
  border-color: #0a5591;
}

.editable input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.save-btn,
.cancel-btn {
  padding: 0.3rem 0.6rem;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  font-size: 0.8rem;
  margin: 0 0.2rem;
}

.save-btn {
  background: #28a745;
  color: white;
}

.save-btn:hover:not(:disabled) {
  background: #218838;
}

.save-btn:disabled {
  background: #94d3a2;
  cursor: not-allowed;
}

.cancel-btn {
  background: #6c757d;
  color: white;
}

.cancel-btn:hover:not(:disabled) {
  background: #5a6268;
}

.cancel-btn:disabled {
  cursor: not-allowed;
}

.no-changes {
  color: #ccc;
}

/* Toast notification */
.toast {
  position: fixed;
  top: 80px;
  right: 20px;
  padding: 1rem 1.5rem;
  border-radius: 4px;
  color: white;
  z-index: 1000;
  animation: slideIn 0.3s ease;
}

.toast.success {
  background: #28a745;
}

.toast.error {
  background: #dc3545;
}

.toast.warning {
  background: #ffc107;
  color: #333;
}

.toast.info {
  background: #17a2b8;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* Responsive adjustments */
@media (max-width: 1200px) {
  .col-user {
    display: none;
  }
}

@media (max-width: 900px) {
  .content {
    padding: 1rem;
  }

  .section-spec-table-container {
    padding: 1rem;
  }

  header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .user-info {
    flex-wrap: wrap;
    justify-content: center;
  }

  .filter-section {
    flex-direction: column;
    align-items: flex-start;
  }

  .filter-section select {
    width: 100%;
    min-width: unset;
  }
}
</style>

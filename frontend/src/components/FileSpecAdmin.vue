<template>
  <div class="file-spec-admin">
    <header>
      <h1>Admin: File Specifications</h1>
      <div class="user-info">
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

      <div v-else-if="fileSpecStore.loading" class="loading">
        Loading file specifications...
      </div>

      <div v-else-if="fileSpecStore.error" class="error">
        {{ fileSpecStore.error }}
      </div>

      <div v-else class="file-spec-table-container">
        <p class="table-description">
          Manage configuration file specifications. Editable fields are highlighted.
          Changes to editable fields will update <code>last_reviewed</code> automatically.
        </p>

        <table class="file-spec-table">
          <thead>
            <tr>
              <th class="col-id">ID</th>
              <th class="col-name">File Name</th>
              <th class="col-desc">Description</th>
              <th class="col-sort">Sort Order</th>
              <th class="col-bool">Custom Sections</th>
              <th class="col-bool">Section Sort</th>
              <th class="col-legacy">Legacy Category</th>
              <th class="col-date">Last Reviewed</th>
              <th class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="spec in fileSpecStore.sortedFileSpecs" :key="spec.file_spec_id">
              <td class="col-id">{{ spec.file_spec_id }}</td>
              <td class="col-name">{{ spec.f_name }}</td>
              <td class="col-desc editable">
                <input
                  type="text"
                  v-model="editState[spec.file_spec_id].file_desc"
                  @change="markDirty(spec.file_spec_id)"
                  maxlength="150"
                  placeholder="Enter description..."
                />
              </td>
              <td class="col-sort editable">
                <input
                  type="number"
                  v-model.number="editState[spec.file_spec_id].sort_order"
                  @change="markDirty(spec.file_spec_id)"
                  min="0"
                />
              </td>
              <td class="col-bool editable">
                <input
                  type="checkbox"
                  v-model="editState[spec.file_spec_id].custom_sections_allowed"
                  @change="markDirty(spec.file_spec_id)"
                />
              </td>
              <td class="col-bool editable">
                <input
                  type="checkbox"
                  v-model="editState[spec.file_spec_id].section_sort_used_by_client"
                  @change="markDirty(spec.file_spec_id)"
                />
              </td>
              <td class="col-legacy">{{ spec.legacy_category_name }}</td>
              <td class="col-date">{{ formatDate(spec.last_reviewed) }}</td>
              <td class="col-actions">
                <button
                  v-if="isDirty(spec.file_spec_id)"
                  @click="saveSpec(spec.file_spec_id)"
                  class="save-btn"
                  :disabled="saving[spec.file_spec_id]"
                >
                  {{ saving[spec.file_spec_id] ? 'Saving...' : 'Save' }}
                </button>
                <button
                  v-if="isDirty(spec.file_spec_id)"
                  @click="resetSpec(spec.file_spec_id)"
                  class="cancel-btn"
                  :disabled="saving[spec.file_spec_id]"
                >
                  Cancel
                </button>
                <span v-if="!isDirty(spec.file_spec_id)" class="no-changes">-</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useFileSpecStore } from '../stores/fileSpec';

const router = useRouter();
const authStore = useAuthStore();
const fileSpecStore = useFileSpecStore();

const toast = reactive({ show: false, message: '', type: 'success' });
const editState = reactive({});
const originalState = reactive({});
const saving = reactive({});

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
  fileSpecStore.fileSpecs.forEach(spec => {
    editState[spec.file_spec_id] = {
      file_desc: spec.file_desc || '',
      sort_order: spec.sort_order,
      custom_sections_allowed: spec.custom_sections_allowed || false,
      section_sort_used_by_client: spec.section_sort_used_by_client || false
    };
    originalState[spec.file_spec_id] = { ...editState[spec.file_spec_id] };
    saving[spec.file_spec_id] = false;
  });
}

function markDirty(id) {
  // Just triggers reactivity - isDirty will re-compute
}

function isDirty(id) {
  const edit = editState[id];
  const orig = originalState[id];
  if (!edit || !orig) return false;

  return edit.file_desc !== orig.file_desc ||
         edit.sort_order !== orig.sort_order ||
         edit.custom_sections_allowed !== orig.custom_sections_allowed ||
         edit.section_sort_used_by_client !== orig.section_sort_used_by_client;
}

function resetSpec(id) {
  const orig = originalState[id];
  if (orig) {
    editState[id] = { ...orig };
  }
}

async function saveSpec(id) {
  saving[id] = true;
  try {
    const data = editState[id];
    const result = await fileSpecStore.updateFileSpec(id, data);

    if (result?.blocked) {
      showToast('Update blocked - database is in read-only mode', 'warning');
    } else {
      showToast('File specification updated', 'success');
      // Update original state to match new saved values
      originalState[id] = { ...editState[id] };
    }
  } catch (error) {
    showToast('Failed to update file specification', 'error');
  } finally {
    saving[id] = false;
  }
}

async function handleLogout() {
  await authStore.logout();
  router.push('/login');
}

// Watch for fileSpecs changes to reinitialize edit state
watch(() => fileSpecStore.fileSpecs, () => {
  initEditState();
}, { deep: true });

onMounted(async () => {
  await authStore.fetchUserRoles();

  if (authStore.isAdmin) {
    await fileSpecStore.loadFileSpecs();
    initEditState();
  }
});
</script>

<style scoped>
.file-spec-admin {
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

.back-link {
  color: white;
  text-decoration: none;
  padding: 0.5rem 1rem;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 4px;
}

.back-link:hover {
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
  max-width: 1400px;
  margin: 0 auto;
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

.table-description code {
  background: #e8e8e8;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
  font-size: 0.9em;
}

.file-spec-table-container {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
}

.file-spec-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.file-spec-table th,
.file-spec-table td {
  padding: 0.75rem 0.5rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.file-spec-table th {
  background: #f8f8f8;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}

.file-spec-table tbody tr:hover {
  background: #fafafa;
}

.col-id {
  width: 50px;
  text-align: center;
}

.col-name {
  width: 150px;
  font-weight: 500;
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

.col-legacy {
  width: 180px;
  color: #666;
  font-size: 0.85em;
}

.col-date {
  width: 150px;
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
  .col-legacy {
    display: none;
  }
}

@media (max-width: 900px) {
  .content {
    padding: 1rem;
  }

  .file-spec-table-container {
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
}
</style>

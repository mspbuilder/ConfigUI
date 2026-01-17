<template>
  <div v-if="visible" class="add-maintenance-control">
    <button @click="toggleForm" class="add-maintenance-btn">
      + RMM_Maintenance - Maintenance: New Task
    </button>

    <div v-if="showForm" class="add-maintenance-form">
      <div class="form-row">
        <label>
          <span>Task Name</span>
          <input
            v-model="taskName"
            type="text"
            placeholder=""
            class="maintenance-input"
            @keyup.enter="handleAdd"
          />
        </label>
      </div>
      <div class="form-actions">
        <button @click="handleAdd" :disabled="!isValid" class="confirm-btn">
          Create New Task
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
</template>

<script setup>
import { ref, computed } from 'vue';

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

const emit = defineEmits(['add-task']);

const showForm = ref(false);
const taskName = ref('');
const errorMessage = ref('');

const visible = computed(() => {
  const isMaintenance = props.categoryName === 'RMM_Maintenance - Maintenance';
  return isMaintenance && props.customSectionsAllowed;
});

const isValid = computed(() => {
  return taskName.value.trim();
});

function toggleForm() {
  showForm.value = !showForm.value;
  if (!showForm.value) {
    resetForm();
  }
}

function resetForm() {
  taskName.value = '';
  errorMessage.value = '';
}

function handleAdd() {
  if (!isValid.value) {
    errorMessage.value = 'Task name is required';
    return;
  }

  emit('add-task', {
    taskName: taskName.value.trim()
  });

  resetForm();
  showForm.value = false;
}

function cancelAdd() {
  resetForm();
  showForm.value = false;
}
</script>

<style scoped>
.add-maintenance-control {
  margin: 1rem 0;
}

.add-maintenance-btn {
  padding: 0.5rem 1rem;
  background: #0a5591;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.add-maintenance-btn:hover {
  background: #084470;
}

.add-maintenance-form {
  margin-top: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  max-width: 400px;
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

.maintenance-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  box-sizing: border-box;
}

.maintenance-input:focus {
  outline: none;
  border-color: #0a5591;
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

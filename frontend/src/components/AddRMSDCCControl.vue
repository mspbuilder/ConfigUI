<template>
  <div v-if="visible" class="add-rmsdcc-control">
    <button @click="toggleForm" class="add-rmsdcc-btn">
      + Add Disk Capacity Entry
    </button>

    <div v-if="showForm" class="add-rmsdcc-form">
      <div class="form-row">
        <label>
          <span>Section</span>
          <input
            v-model="sectionName"
            type="text"
            placeholder="e.g., DiskCheck"
            class="rmsdcc-input"
          />
        </label>
      </div>
      <div class="form-row">
        <label>
          <span>Property</span>
          <input
            v-model="propertyName"
            type="text"
            placeholder="e.g., Threshold"
            class="rmsdcc-input"
          />
        </label>
      </div>
      <div class="form-row">
        <label>
          <span>Value</span>
          <input
            v-model="propertyValue"
            type="text"
            placeholder="e.g., 80"
            class="rmsdcc-input"
            @keyup.enter="handleAdd"
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
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  // legacy_category_name must be 'RMSDCC - Disk Capacity Check' for this control to show
  categoryName: {
    type: String,
    default: ''
  },
  customSectionsAllowed: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['add-entry']);

const showForm = ref(false);
const sectionName = ref('');
const propertyName = ref('');
const propertyValue = ref('');
const errorMessage = ref('');

// Only visible for RMSDCC category that allows custom sections
const visible = computed(() => {
  const isRMSDCC = props.categoryName === 'RMSDCC - Disk Capacity Check';
  return isRMSDCC && props.customSectionsAllowed;
});

// Validate all three fields are filled
const isValid = computed(() => {
  return sectionName.value.trim() &&
         propertyName.value.trim() &&
         propertyValue.value.trim();
});

function toggleForm() {
  showForm.value = !showForm.value;
  if (!showForm.value) {
    resetForm();
  }
}

function resetForm() {
  sectionName.value = '';
  propertyName.value = '';
  propertyValue.value = '';
  errorMessage.value = '';
}

function handleAdd() {
  if (!isValid.value) {
    errorMessage.value = 'All fields are required';
    return;
  }

  emit('add-entry', {
    section: sectionName.value.trim(),
    property: propertyName.value.trim(),
    value: propertyValue.value.trim()
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
.add-rmsdcc-control {
  margin: 1rem 0;
}

.add-rmsdcc-btn {
  padding: 0.5rem 1rem;
  background: #0a5591;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.add-rmsdcc-btn:hover {
  background: #084470;
}

.add-rmsdcc-form {
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

.rmsdcc-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  box-sizing: border-box;
}

.rmsdcc-input:focus {
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

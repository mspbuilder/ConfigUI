<template>
  <div v-if="visible" class="add-section-control">
    <button @click="toggleForm" class="add-section-btn">
      + Add Section
    </button>

    <div v-if="showForm" class="add-section-form">
      <input
        v-model="sectionName"
        type="text"
        placeholder="Section name"
        class="section-input"
        @keyup.enter="handleAdd"
      />
      <div class="form-actions">
        <button @click="handleAdd" :disabled="!sectionName.trim()" class="confirm-btn">
          Add
        </button>
        <button @click="cancelAdd" class="cancel-btn">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
  customSectionsAllowed: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['add-section']);

const showForm = ref(false);
const sectionName = ref('');

const visible = computed(() => props.customSectionsAllowed);

function toggleForm() {
  showForm.value = !showForm.value;
  if (!showForm.value) {
    sectionName.value = '';
  }
}

function handleAdd() {
  if (sectionName.value.trim()) {
    emit('add-section', sectionName.value.trim());
    sectionName.value = '';
    showForm.value = false;
  }
}

function cancelAdd() {
  sectionName.value = '';
  showForm.value = false;
}
</script>

<style scoped>
.add-section-control {
  margin: 1rem 0;
}

.add-section-btn {
  padding: 0.5rem 1rem;
  background: #0a5591;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.add-section-btn:hover {
  background: #084470;
}

.add-section-form {
  margin-top: 0.5rem;
  padding: 1rem;
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-input {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  margin-bottom: 0.5rem;
}

.section-input:focus {
  outline: none;
  border-color: #0a5591;
}

.form-actions {
  display: flex;
  gap: 0.5rem;
}

.confirm-btn {
  padding: 0.4rem 1rem;
  background: #0a5591;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
</style>

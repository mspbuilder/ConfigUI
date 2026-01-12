<template>
  <div class="secure-field-overlay" @click.self="$emit('close')">
    <div class="secure-field-editor">
      <div class="editor-header">
        <h3>Edit Secure Field</h3>
        <button class="close-btn" @click="$emit('close')">&times;</button>
      </div>

      <div class="editor-body">
        <div class="field-info">
          <label>Property:</label>
          <span class="property-name">{{ propertyName }}</span>
        </div>

        <div class="field-group">
          <label for="secure-value">Value:</label>
          <input
            id="secure-value"
            type="text"
            v-model="localValue"
            :placeholder="placeholder"
            class="value-input"
          />
        </div>

        <div class="field-group">
          <label>Security Level:</label>
          <div class="radio-group">
            <label class="radio-option">
              <input
                type="radio"
                v-model="securityLevel"
                value="plain"
                name="security-level"
              />
              <span>Plain Text</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                v-model="securityLevel"
                value="password"
                name="security-level"
              />
              <span>Password (user accounts only)</span>
            </label>
            <label class="radio-option">
              <input
                type="radio"
                v-model="securityLevel"
                value="secure"
                name="security-level"
              />
              <span>Secure (decryptable)</span>
            </label>
          </div>
        </div>

        <div v-if="securityLevel !== 'plain'" class="security-notice">
          <span class="notice-icon">&#x1f512;</span>
          <span>Value will be stored encrypted in the database.</span>
        </div>
      </div>

      <div class="editor-footer">
        <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" @click="handleSave" :disabled="saving">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  configId: { type: [String, Number], required: true },
  propertyName: { type: String, required: true },
  initialValue: { type: String, default: '' },
  initialSecurityLevel: { type: String, default: 'plain' }, // 'plain', 'password', 'secure'
  placeholder: { type: String, default: '' },
});

const emit = defineEmits(['close', 'save']);

const localValue = ref(props.initialValue);
const securityLevel = ref(props.initialSecurityLevel);
const saving = ref(false);

// Watch for prop changes
watch(() => props.initialValue, (newVal) => {
  localValue.value = newVal;
});

watch(() => props.initialSecurityLevel, (newVal) => {
  securityLevel.value = newVal;
});

async function handleSave() {
  saving.value = true;
  try {
    emit('save', {
      configId: props.configId,
      value: localValue.value,
      securityLevel: securityLevel.value,
    });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.secure-field-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.secure-field-editor {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 450px;
  margin: 1rem;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid #e5e5e5;
  background: #0a5591;
  color: white;
  border-radius: 8px 8px 0 0;
}

.editor-header h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: white;
  cursor: pointer;
  padding: 0;
  line-height: 1;
  opacity: 0.8;
}

.close-btn:hover {
  opacity: 1;
}

.editor-body {
  padding: 1.25rem;
}

.field-info {
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #f0f0f0;
}

.field-info label {
  font-size: 0.75rem;
  color: #666;
  display: block;
  margin-bottom: 0.25rem;
}

.field-info .property-name {
  font-weight: 600;
  color: #333;
}

.field-group {
  margin-bottom: 1rem;
}

.field-group > label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 0.5rem;
}

.value-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.875rem;
  font-family: inherit;
  box-sizing: border-box;
}

.value-input:focus {
  outline: none;
  border-color: #0a5591;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  padding: 0.5rem 0.75rem;
  border: 1px solid #e5e5e5;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.radio-option:hover {
  background: #f8f8f8;
}

.radio-option input[type="radio"] {
  margin: 0;
}

.radio-option span {
  font-size: 0.875rem;
  color: #333;
}

.security-notice {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background: #fff8e6;
  border: 1px solid #f0d060;
  border-radius: 4px;
  font-size: 0.8rem;
  color: #806000;
}

.notice-icon {
  font-size: 1rem;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid #e5e5e5;
  background: #f8f8f8;
  border-radius: 0 0 8px 8px;
}

.btn {
  padding: 0.5rem 1.25rem;
  border-radius: 4px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  border: none;
  transition: background-color 0.15s;
}

.btn-secondary {
  background: #e5e5e5;
  color: #333;
}

.btn-secondary:hover {
  background: #d5d5d5;
}

.btn-primary {
  background: #0a5591;
  color: white;
}

.btn-primary:hover {
  background: #084470;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

<template>
  <div v-if="visible" class="request-data-sync-control">
    <button
      @click="handleRequestSync"
      :disabled="loading"
      class="request-sync-btn"
    >
      {{ loading ? 'Requesting...' : 'Request Data Sync' }}
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useConfigStore } from '../stores/config';

const props = defineProps({
  customerId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['sync-requested', 'error']);

const configStore = useConfigStore();

const loading = ref(false);

// Show when a customer is selected (for all users)
const visible = computed(() => {
  return !!props.customerId;
});

async function handleRequestSync() {
  if (loading.value) return;

  loading.value = true;
  try {
    const result = await configStore.requestDataSync(props.customerId);
    if (result?.blocked) {
      emit('error', 'Sync request blocked - database is in read-only mode');
    } else {
      emit('sync-requested');
    }
  } catch (error) {
    emit('error', 'Failed to request data sync');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.request-data-sync-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.request-sync-btn {
  padding: 0.5rem 1rem;
  background: #0a5591;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 500;
}

.request-sync-btn:hover:not(:disabled) {
  background: #084470;
}

.request-sync-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.sync-status {
  font-size: 0.8rem;
  color: #666;
  font-style: italic;
}
</style>

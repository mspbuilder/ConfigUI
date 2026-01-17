<template>
  <div v-if="visible" class="request-data-sync-control">
    <button
      @click="handleRequestSync"
      :disabled="!canRequest || loading"
      class="request-sync-btn"
      title="One Per Day"
    >
      {{ loading ? 'Requesting...' : 'Request Data Sync' }}
    </button>
    <span v-if="!canRequest && !loading" class="sync-status">
      (Requested within last 24 hours)
    </span>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useConfigStore } from '../stores/config';
import { useAuthStore } from '../stores/auth';

const props = defineProps({
  customerId: {
    type: String,
    default: ''
  }
});

const emit = defineEmits(['sync-requested', 'error']);

const configStore = useConfigStore();
const authStore = useAuthStore();

const loading = ref(false);
const canRequest = ref(false);
const checked = ref(false);

// Only show for admin users when a customer is selected
const visible = computed(() => {
  return authStore.isAdmin && props.customerId;
});

// Check if sync can be requested when customerId changes
watch(() => props.customerId, async (newCustomerId) => {
  if (newCustomerId) {
    await checkSyncStatus();
  } else {
    canRequest.value = false;
    checked.value = false;
  }
}, { immediate: true });

async function checkSyncStatus() {
  if (!props.customerId) return;

  try {
    const result = await configStore.checkDataSyncStatus(props.customerId);
    canRequest.value = result?.canRequest ?? true;
    checked.value = true;
  } catch (error) {
    // On error, allow the request (backend will validate)
    canRequest.value = true;
    checked.value = true;
  }
}

async function handleRequestSync() {
  if (!canRequest.value || loading.value) return;

  loading.value = true;
  try {
    const result = await configStore.requestDataSync(props.customerId);
    if (result?.blocked) {
      emit('error', 'Sync request blocked - database is in read-only mode');
    } else {
      canRequest.value = false;
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

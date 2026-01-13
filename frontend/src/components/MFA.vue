<template>
  <div class="mfa-container">
    <div class="mfa-card">
      <h1>Multi-Factor Authentication</h1>
      
      <div v-if="showQrCode" class="qr-section">
        <p>Scan the QR code below with your authenticator app</p>
        <p>For assistance email <b>support@mspbuilder.com</b></p>
        <div class="qr-code">
          <img :src="qrCode" alt="QR Code" />
        </div>
        <div class="secret-section">
          <h4>Or manually enter this key:</h4>
          <div class="secret-code" @click="copySecret">
            {{ secret }}
            <i class="copy-icon">📋</i>
          </div>
        </div>
      </div>

      <div class="input-section">
        <p v-if="!showQrCode">Enter your 6-digit authentication code</p>
        <div class="mfa-inputs">
          <input
            v-for="(digit, index) in 6"
            :key="index"
            :ref="el => inputs[index] = el"
            v-model="mfaCode[index]"
            @input="handleInput(index, $event)"
            @keydown.delete="handleBackspace(index)"
            @keydown.enter="handleEnter"
            @click="selectInput(index)"
            @paste="handlePaste($event)"
            type="text"
            inputmode="numeric"
            pattern="[0-9]"
            maxlength="1"
            class="mfa-input"
          />
        </div>
        <div v-if="error" class="error">{{ error }}</div>
        <button 
          @click="verifyCode" 
          :disabled="loading || mfaCode.join('').length !== 6"
          class="verify-btn"
        >
          {{ loading ? 'Verifying...' : 'Authenticate' }}
        </button>
        <p class="help-text">
          Look for 'MSPBuilder' in your authenticator app
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import api from '../services/api';

const router = useRouter();
const authStore = useAuthStore();

const inputs = ref([]);
const mfaCode = ref(['', '', '', '', '', '']);
const loading = ref(false);
const error = ref('');
const showQrCode = ref(false);
const qrCode = ref('');
const secret = ref('');

onMounted(async () => {
  // Check if user needs MFA setup or just verification
  try {
    const response = await api.generateMfa();
    // Only show QR if this is a new setup (backend should indicate)
    // For now, check if secret matches what we might already have
    if (response.data.qrCode && response.data.needsSetup) {
      showQrCode.value = true;
      qrCode.value = response.data.qrCode;
      secret.value = response.data.secret;
    }
    // Otherwise just show the code input
  } catch (err) {
    // MFA already set up, just show input
    console.log('MFA check:', err);
  }
});

function handleInput(index, event) {
  const value = event.target.value;
  if (value && /^\d$/.test(value)) {
    mfaCode.value[index] = value;
    if (index < 5) {
      inputs.value[index + 1]?.focus();
    }
  }
}

function handleBackspace(index) {
  if (!mfaCode.value[index] && index > 0) {
    inputs.value[index - 1]?.focus();
  }
}

function selectInput(index) {
  inputs.value[index]?.select();
}

function handlePaste(event) {
  event.preventDefault();
  const paste = event.clipboardData.getData('text');
  const digits = paste.replace(/\D/g, '').slice(0, 6);
  
  for (let i = 0; i < digits.length; i++) {
    mfaCode.value[i] = digits[i];
  }
  
  if (digits.length === 6) {
    inputs.value[5]?.focus();
  } else {
    inputs.value[digits.length]?.focus();
  }
}

function copySecret() {
  navigator.clipboard.writeText(secret.value);
}

function handleEnter() {
  // Submit if all 6 digits are entered
  if (mfaCode.value.join('').length === 6 && !loading.value) {
    verifyCode();
  }
}

async function verifyCode() {
  loading.value = true;
  error.value = '';
  try {
    await authStore.verifyMfa(mfaCode.value.join(''));
    router.push('/');
  } catch (err) {
    error.value = err.response?.data?.error || 'Verification failed';
    mfaCode.value = ['', '', '', '', '', ''];
    inputs.value[0]?.focus();
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.mfa-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #0dccea, #0d70ea);
}

.mfa-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 500px;
}

h1 {
  text-align: center;
  color: #0a5591;
  margin-bottom: 2rem;
}

.qr-section {
  text-align: center;
  margin-bottom: 2rem;
}

.qr-code {
  margin: 1rem 0;
}

.qr-code img {
  max-width: 250px;
}

.secret-section {
  margin-top: 1rem;
}

.secret-code {
  background: #f5f5f5;
  padding: 1rem;
  border-radius: 4px;
  font-family: monospace;
  font-size: 1.1rem;
  cursor: pointer;
  position: relative;
  word-break: break-all;
}

.secret-code:hover {
  background: #e8e8e8;
}

.copy-icon {
  margin-left: 0.5rem;
}

.input-section {
  text-align: center;
}

.mfa-inputs {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  margin: 1.5rem 0;
}

.mfa-input {
  width: 3rem;
  height: 3rem;
  text-align: center;
  font-size: 1.5rem;
  border: 2px solid #ddd;
  border-radius: 4px;
}

.mfa-input:focus {
  outline: none;
  border-color: #0a5591;
}

.verify-btn {
  width: 100%;
  padding: 0.75rem;
  background: linear-gradient(#0dccea, #0d70ea);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: bold;
  margin-top: 1rem;
}

.verify-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.verify-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: red;
  margin: 1rem 0;
  font-weight: bold;
}

.help-text {
  margin-top: 1rem;
  color: #666;
  font-size: 0.9rem;
}
</style>

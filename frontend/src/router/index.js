import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import MFA from '../components/MFA.vue';
import ConfigManager from '../components/ConfigManager.vue';

const routes = [
  {
    path: '/mfa',
    name: 'MFA',
    component: MFA,
    meta: { requiresAuth: true, requiresMFA: false },
  },
  {
    path: '/',
    name: 'ConfigManager',
    component: ConfigManager,
    meta: { requiresAuth: true, requiresMFA: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach(async (to, from, next) => {
  const authStore = useAuthStore();

  // Check for MojoPortal token in URL
  const urlParams = new URLSearchParams(window.location.search);
  const mojoToken = urlParams.get('token');
  
  if (mojoToken && !authStore.authenticated) {
    try {
      await authStore.authenticateFromMojo(mojoToken);
      // Remove token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (error) {
      console.error('MojoPortal authentication failed:', error);
      alert('Authentication failed. Please try again from MojoPortal.');
      window.close();
      return;
    }
  }

  // Check auth status if navigating to protected route
  if (to.meta.requiresAuth) {
    if (!authStore.authenticated) {
      try {
        await authStore.checkAuth();
      } catch (error) {
        alert('Not authenticated. Please launch from MojoPortal.');
        window.close();
        return;
      }
    }

    if (to.meta.requiresMFA && !authStore.mfaVerified) {
      return next('/mfa');
    }
  }

  next();
});

export default router;

import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
    {
      path: '/my-bitnp',
      name: 'my-bitnp',
      component: () => import('@/views/MyBitnpView.vue'),
    },
  ],
})

router.beforeEach(async (to) => {
  const { isAuthenticated, refresh } = useAuth()

  if (!isAuthenticated.value) {
    try {
      await refresh()
    } catch {
      // fall through to the redirect below if the auth check fails
    }
  }

  if (!isAuthenticated.value && !to.meta.public) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }

  if (isAuthenticated.value && to.meta.public) {
    return { name: 'home' }
  }

  return true
})

export default router

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
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
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
      path: '/manage',
      name: 'manage',
      component: () => import('@/views/ManageView.vue'),
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('@/views/UserView.vue'),
    },
    {
      path: '/users/:id',
      name: 'user',
      component: () => import('@/views/UserView.vue'),
    },
    {
      path: '/my-bitnp',
      redirect: { name: 'account' },
    },
    {
      path: '/projects',
      name: 'project',
      component: () => import('@/views/ProjectView.vue'),
    },
    {
      path: '/projects/create',
      name: 'project-create',
      component: () => import('@/views/ProjectCreateView.vue'),
    },
    {
      path: '/projects/:id/edit',
      name: 'project-edit',
      component: () => import('@/views/ProjectCreateView.vue'),
    },
    {
      path: '/projects/:id/tasks/create',
      name: 'task-create',
      component: () => import('@/views/TaskCreateView.vue'),
    },
    {
      path: '/projects/:id/tasks/:taskId/edit',
      name: 'task-edit',
      component: () => import('@/views/TaskCreateView.vue'),
    },
    {
      path: '/projects/:id/tasks/:taskId',
      name: 'task-detail',
      component: () => import('@/views/TaskDetailView.vue'),
    },
    {
      path: '/projects/:id/tasks/:taskId/actions/create',
      name: 'action-create',
      component: () => import('@/views/ActionCreateView.vue'),
    },
    {
      path: '/projects/:id/tasks/:taskId/actions/:actionId/edit',
      name: 'action-edit',
      component: () => import('@/views/ActionCreateView.vue'),
    },
    {
      path: '/projects/:id',
      name: 'project-detail',
      component: () => import('@/views/ProjectDetailView.vue'),
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

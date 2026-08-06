import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';
import { loginRoute } from './auth-navigation';

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/HomeView.vue')
  },
  {
    path: '/blog',
    name: 'blog',
    component: () => import('./views/BlogView.vue')
  },
  {
    path: '/post/:id',
    name: 'post',
    component: () => import('./views/PostView.vue')
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('./views/AdminView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('./views/AboutView.vue')
  },
  {
    path: '/account',
    name: 'account',
    component: () => import('./views/AccountView.vue'),
    meta: { requiresAuth: true }
  },
  {
    path: '/sites',
    name: 'sitemap',
    component: () => import('./views/SiteMapView.vue')
  },
  {
    path: '/document',
    name: 'document',
    component: () => import('./views/DocumentView.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('./views/LoginView.vue')
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('./views/LoginView.vue')
  }
];

const router = createRouter({
  history: createWebHistory(),
  routes
});

router.beforeEach(async to => {
  if (!to.meta.requiresAuth) return true;

  try {
    const response = await fetch('/api/auth/me', { credentials: 'include' });
    if (response.ok) return true;
    if (response.status === 401 || response.status === 404) return loginRoute(to.fullPath);
  } catch (error) {
    console.error('Could not verify authentication before navigation:', error);
  }

  // Let the destination render its normal server-error state for non-auth failures.
  return true;
});

export default router;

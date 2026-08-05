import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

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
    component: () => import('./views/AdminView.vue')
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('./views/AboutView.vue')
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

export default router;

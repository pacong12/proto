import { createRouter, createWebHistory } from 'vue-router';
import ExplorePage from '@/pages/ExplorePage.vue';

export const router = createRouter({
  history: createWebHistory(),
  scrollBehavior(_to, _from, savedPosition) {
    // Restore scroll position when navigating back; scroll to top on new routes.
    if (savedPosition) {
      return savedPosition;
    }
    return { top: 0, behavior: 'smooth' };
  },
  routes: [
    {
      path: '/',
      redirect: '/launchpad',
    },
    {
      path: '/launchpad',
      name: 'explore',
      component: ExplorePage,
    },
    {
      path: '/launchpad/create',
      name: 'create',
      component: () => import('@/pages/CreatePage.vue'),
    },
    {
      path: '/memestock',
      name: 'memestock',
      component: () => import('@/pages/MemestockPage.vue'),
    },
    {
      path: '/launchpad/:address',
      name: 'trade',
      component: () => import('@/pages/TradePage.vue'),
      props: true,
    },
    {
      path: '/trade',
      redirect: '/launchpad',
    },
    {
      path: '/analytics',
      name: 'analytics',
      component: () => import('@/pages/AnalyticsPage.vue'),
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('@/pages/ProfilePage.vue'),
    },
    {
      path: '/terms-of-service',
      name: 'terms',
      component: () => import('@/pages/TermsPage.vue'),
    },
    {
      path: '/privacy-policy',
      name: 'privacy',
      component: () => import('@/pages/PrivacyPage.vue'),
    },
    {
      path: '/cookie-policy',
      name: 'cookie-policy',
      component: () => import('@/pages/CookiePolicyPage.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/launchpad',
    },
  ],
});

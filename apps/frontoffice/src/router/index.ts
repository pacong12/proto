import { createRouter, createWebHistory } from 'vue-router';

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
      component: () => import('@/pages/ExplorePage.vue'),
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
      path: '/feed',
      name: 'feed',
      component: () => import('@/pages/FeedPage.vue'),
    },
    {
      path: '/feed/:id',
      name: 'feed-detail',
      component: () => import('@/pages/PostDetailPage.vue'),
      props: true,
    },
    {
      path: '/post/:id',
      name: 'post-detail',
      component: () => import('@/pages/PostDetailPage.vue'),
      props: true,
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
      path: '/profile/:address?',
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

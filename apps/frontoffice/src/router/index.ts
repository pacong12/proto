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
      alias: ['/explore'],
      name: 'explore',
      component: () => import('@/pages/ExplorePage.vue'),
    },
    {
      path: '/launchpad/create',
      alias: ['/create'],
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
      path: '/post/:id',
      alias: ['/post/detail/:id', '/feed/:id'],
      name: 'post-detail',
      component: () => import('@/pages/PostDetailPage.vue'),
      props: true,
    },
    {
      path: '/token/:address',
      alias: ['/launchpad/:address', '/trade/:address'],
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
      path: '/u/:address?',
      alias: ['/profile/:address?', '/user/:address?', '/@:address?'],
      name: 'profile',
      component: () => import('@/pages/ProfilePage.vue'),
      props: true,
    },
    {
      path: '/terms-of-service',
      alias: ['/terms'],
      name: 'terms',
      component: () => import('@/pages/TermsPage.vue'),
    },
    {
      path: '/privacy-policy',
      alias: ['/privacy'],
      name: 'privacy',
      component: () => import('@/pages/PrivacyPage.vue'),
    },
    {
      path: '/cookie-policy',
      alias: ['/cookies', '/cookie'],
      name: 'cookie-policy',
      component: () => import('@/pages/CookiePolicyPage.vue'),
    },
    // Direct username slug route (like X / Twitter: /:username)
    {
      path: '/:username([a-zA-Z0-9_#.-]+)',
      name: 'user-profile-slug',
      component: () => import('@/pages/ProfilePage.vue'),
      props: (route) => ({ address: route.params.username }),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/launchpad',
    },
  ],
});

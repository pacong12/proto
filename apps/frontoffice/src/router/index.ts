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
      meta: {
        seo: {
          title: 'Explore tokens',
          description:
            'Discover trending, new and graduated fixed-supply tokens on Robinhood Chain and Arc Network.',
        },
      },
      component: () => import('@/pages/ExplorePage.vue'),
    },
    {
      path: '/launchpad/create',
      alias: ['/create'],
      name: 'create',
      meta: {
        seo: {
          title: 'Create a token',
          description:
            'Launch a fixed-supply token in minutes on Robinhood Chain or Arc Network. No code, permanently locked liquidity.',
        },
      },
      component: () => import('@/pages/CreatePage.vue'),
    },
    {
      path: '/memestock',
      name: 'memestock',
      meta: {
        seo: {
          title: 'Memestock',
          description: 'Community calls and sentiment for tokens launched on goton.',
        },
      },
      component: () => import('@/pages/MemestockPage.vue'),
    },
    {
      path: '/feed',
      name: 'feed',
      meta: {
        seo: {
          title: 'Feed',
          description: 'The latest posts, calls and trades from the goton community.',
        },
      },
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
      meta: {
        seo: {
          title: 'Analytics',
          description:
            'Protocol volume, launches, graduations and buybacks across Robinhood Chain and Arc Network.',
        },
      },
      component: () => import('@/pages/AnalyticsPage.vue'),
    },
    {
      path: '/u/:address?',
      alias: ['/profile/:address?', '/user/:address?', '/@:address?'],
      name: 'profile',
      meta: { seo: { title: 'Profile', noindex: true } },
      component: () => import('@/pages/ProfilePage.vue'),
      props: true,
    },
    {
      path: '/terms-of-service',
      alias: ['/terms'],
      name: 'terms',
      meta: {
        seo: {
          title: 'Terms of Service',
          description: 'Terms of service for the goton non-custodial token launchpad.',
        },
      },
      component: () => import('@/pages/TermsPage.vue'),
    },
    {
      path: '/privacy-policy',
      alias: ['/privacy'],
      name: 'privacy',
      meta: {
        seo: {
          title: 'Privacy Policy',
          description:
            'How goton handles on-chain data, local storage, analytics and your right to erasure.',
        },
      },
      component: () => import('@/pages/PrivacyPage.vue'),
    },
    {
      path: '/cookie-policy',
      alias: ['/cookies', '/cookie'],
      name: 'cookie-policy',
      meta: {
        seo: {
          title: 'Cookie Policy',
          description: 'Which browser storage goton uses and how analytics consent works.',
        },
      },
      component: () => import('@/pages/CookiePolicyPage.vue'),
    },
    // Direct username slug route (like X / Twitter: /:username)
    {
      path: '/:username([a-zA-Z0-9_#.-]+)',
      name: 'user-profile-slug',
      meta: { seo: { title: 'Profile', noindex: true } },
      component: () => import('@/pages/ProfilePage.vue'),
      props: (route) => ({ address: route.params.username }),
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      meta: { seo: { title: 'Page not found', noindex: true } },
      component: () => import('@/pages/NotFoundPage.vue'),
    },
  ],
});

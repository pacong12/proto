import { createRouter, createWebHistory } from 'vue-router';
import { SEO_PAGES } from '@goton/shared-types';
import { currentLocale } from '@/lib/i18n';
import { legalUrl, type LegalPage } from '@/lib/site';
import NotFoundPage from '@/pages/NotFoundPage.vue';

/** Legal pages are served by the docs site; the edge worker 301s these paths, this covers SPA links. */
function leaveForLegalPage(page: LegalPage): false {
  window.location.replace(legalUrl(page, currentLocale.value));
  return false;
}

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
        seo: SEO_PAGES['/launchpad'],
      },
      component: () => import('@/pages/ExplorePage.vue'),
    },
    {
      path: '/launchpad/create',
      alias: ['/create'],
      name: 'create',
      meta: {
        seo: SEO_PAGES['/launchpad/create'],
      },
      component: () => import('@/pages/CreatePage.vue'),
    },
    {
      path: '/memestock',
      name: 'memestock',
      meta: {
        seo: SEO_PAGES['/memestock'],
      },
      component: () => import('@/pages/MemestockPage.vue'),
    },
    {
      path: '/feed',
      name: 'feed',
      meta: {
        seo: SEO_PAGES['/feed'],
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
      path: '/pnl/:wallet(0x[a-fA-F0-9]{40})/:token(0x[a-fA-F0-9]{40})',
      name: 'pnl',
      meta: { seo: { title: 'PnL', noindex: true } },
      component: () => import('@/pages/PnlPage.vue'),
      props: true,
    },
    {
      path: '/analytics',
      name: 'analytics',
      meta: {
        seo: SEO_PAGES['/analytics'],
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
      beforeEnter: () => leaveForLegalPage('terms-of-service'),
      component: NotFoundPage,
    },
    {
      path: '/privacy-policy',
      alias: ['/privacy'],
      name: 'privacy',
      beforeEnter: () => leaveForLegalPage('privacy-policy'),
      component: NotFoundPage,
    },
    {
      path: '/cookie-policy',
      alias: ['/cookies', '/cookie'],
      name: 'cookie-policy',
      beforeEnter: () => leaveForLegalPage('cookie-policy'),
      component: NotFoundPage,
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
      component: NotFoundPage,
    },
  ],
});

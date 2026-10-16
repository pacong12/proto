import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './style.css';
import 'vue-sonner/style.css';
import './lib/appkit';

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
  const error = err as Error;
  console.error('[Goton App Error]', error?.message || String(err), error?.stack, info);
};
router.onError((err) => {
  console.error('[Router Error]', err?.message, err?.stack);
});

// Dynamically sync canonical link and OpenGraph URL to current host and route
router.afterEach((to) => {
  if (typeof window === 'undefined') return;
  const canonical = document.querySelector('link[rel="canonical"]');
  const currentUrl = `${window.location.origin}${to.path}`;
  if (canonical) {
    canonical.setAttribute('href', currentUrl);
  }
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) {
    ogUrl.setAttribute('content', currentUrl);
  }
  const twitterUrl = document.querySelector('meta[name="twitter:url"]');
  if (twitterUrl) {
    twitterUrl.setAttribute('content', currentUrl);
  }
});

app.use(router);
app.mount('#app');

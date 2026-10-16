import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './style.css';
import 'vue-sonner/style.css';
import { initAnalytics } from './lib/analytics';
import { applyRouteSeo } from './lib/seo';
import { preloadAppKitForReturningUser } from './lib/appkit-loader';

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
  const error = err as Error;
  console.error('[Goton App Error]', error?.message || String(err), error?.stack, info);
};
router.onError((err) => {
  console.error('[Router Error]', err?.message, err?.stack);
});

// Per-route title, description, canonical URL (production domain) and social tags.
router.afterEach((to) => applyRouteSeo(to));

app.use(router);
app.mount('#app');
initAnalytics();
preloadAppKitForReturningUser();

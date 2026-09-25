import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './style.css';
import './lib/appkit';

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
  const error = err as Error;
  console.error('[Proto App Error]', error?.message || String(err), error?.stack, info);
};
router.onError((err) => {
  console.error('[Router Error]', err?.message, err?.stack);
});

app.use(router);
app.mount('#app');

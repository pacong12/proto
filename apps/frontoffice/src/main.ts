import { createApp } from 'vue';
import App from './App.vue';
import { router } from './router';
import './style.css';
import './lib/appkit';

const app = createApp(App);

app.config.errorHandler = (err, _instance, info) => {
  console.error('[Proto App Error]', err, info);
};

app.use(router);
app.mount('#app');

import DefaultTheme from 'vitepress/theme';
import type { App } from 'vue';
import { Badge } from '../../src/components/ui/badge';
import { Card } from '../../src/components/ui/card';
import { Progress } from '../../src/components/ui/progress';
import './custom.css';

export default {
  extends: DefaultTheme,
  enhanceApp({ app }: { app: App }) {
    app.component('Badge', Badge);
    app.component('Card', Card);
    app.component('Progress', Progress);
  },
};

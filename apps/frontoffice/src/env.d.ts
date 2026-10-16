/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

interface ImportMetaEnv {
  /** Public app origin; always set by vite.config.ts (default https://goton.fun). */
  readonly VITE_APP_URL: string;
  /** Public docs origin; always set by vite.config.ts (default https://docs.goton.fun). */
  readonly VITE_DOCS_URL: string;
}

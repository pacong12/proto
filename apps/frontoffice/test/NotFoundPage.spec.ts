// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import NotFoundPage from '../src/pages/NotFoundPage.vue';

async function render(path: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/launchpad', component: { template: '<div>launchpad</div>' } },
      { path: '/:pathMatch(.*)*', component: NotFoundPage },
    ],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(NotFoundPage, { global: { plugins: [router] } });
  return { wrapper, router };
}

describe('NotFoundPage', () => {
  it('shows 404, the requested path and an accessible heading', async () => {
    const { wrapper } = await render('/no/such/page');
    expect(wrapper.text()).toContain('404');
    expect(wrapper.text()).toContain('/no/such/page');
    expect(wrapper.get('h1#not-found-title').text()).toBe('Page not found');
    expect(wrapper.get('section').attributes('aria-labelledby')).toBe('not-found-title');
  });

  it('links back to the launchpad and to the docs in a new tab', async () => {
    const { wrapper } = await render('/missing');
    expect(wrapper.get('a[href="/launchpad"]').text()).toContain('Back to launchpad');
    const docs = wrapper.get('a[target="_blank"]');
    expect(docs.attributes('rel')).toContain('noopener');
  });

  it('goes back in history when possible, otherwise to the launchpad', async () => {
    const { wrapper, router } = await render('/missing');
    const pushed: string[] = [];
    router.afterEach((to) => pushed.push(to.path));
    Object.defineProperty(window.history, 'length', { value: 1, configurable: true });
    await wrapper.get('button').trigger('click');
    await flushPromises();
    expect(pushed).toContain('/launchpad');
  });
});

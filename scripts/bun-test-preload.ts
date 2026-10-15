import { plugin } from 'bun';

// Vue SFC loader for Bun test runner — returns a minimal stub component object
plugin({
  name: 'vue-sfc-bun-loader',
  setup(build) {
    build.onLoad({ filter: /\.vue$/ }, async (args) => {
      const fileName = args.path.split('/').pop()?.replace('.vue', '') || 'VueComponent';
      return {
        contents: `
          export default {
            name: "${fileName}",
            __name: "${fileName}",
            setup() { return {}; }
          };
        `,
        loader: 'js',
      };
    });
  },
});

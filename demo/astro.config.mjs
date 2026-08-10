import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import node from '@astrojs/node';
import icon from 'astro-icon';
import datastar from '@wrux/astro-datastar';

export default defineConfig({
  devToolbar: { enabled: false },
  adapter: node({ mode: 'standalone' }),
  integrations: [datastar({ entrypoint: '/src/datastar/index.ts' }), mdx(), icon()],
  markdown: {
    shikiConfig: { theme: 'github-dark' },
  },
});

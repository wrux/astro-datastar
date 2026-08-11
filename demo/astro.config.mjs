import cloudflare from '@astrojs/cloudflare';
import mdx from '@astrojs/mdx';
import datastar from '@wrux/astro-datastar';
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';

export default defineConfig({
  devToolbar: { enabled: false },
  adapter: cloudflare(),
  build: {
    inlineStylesheets: 'always',
  },
  integrations: [
    datastar({ entrypoint: '/src/datastar/index.ts' }),
    mdx(),
    icon(),
  ],
  markdown: {
    shikiConfig: { theme: 'github-dark' },
  },
});

import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import datastar from '@wrux/astro-datastar';

export default defineConfig({
  adapter: node({ mode: 'standalone' }),
  integrations: [datastar({ entrypoint: '/src/datastar/index.ts' })],
});

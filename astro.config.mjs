// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://englishtoburmese.com',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: {
    host: true,
    allowedHosts: ['.monkeycode-ai.live'],
    headers: {
      'Permissions-Policy': 'microphone=*, camera=*',
    },
  },
});

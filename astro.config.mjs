// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://englishtoburmese.com',
  output: 'server',
  adapter: cloudflare(),
  server: {
    host: true,
    allowedHosts: ['.monkeycode-ai.live'],
    headers: {
      'Permissions-Policy': 'microphone=*, camera=*',
    },
  },
});

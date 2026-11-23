import { defineConfig } from 'astro/config';
import fs from 'node:fs';

const ayarlar = JSON.parse(fs.readFileSync('./veri/ayarlar.json', 'utf8'));

export default defineConfig({
  site: ayarlar.siteAdresi,
  output: 'static',
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
});

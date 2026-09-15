import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { serviceWorkerSource } from './pwa-worker.mjs';

function staticPwa() {
  return {
    name: 'medicalsys-static-pwa',
    apply: 'build',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((name) => /\.(js|css|svg|woff2)$/.test(name)).map((name) => '/' + name);
      const precache = Object.values(bundle).filter((entry) => entry.type === 'chunk' && (entry.isEntry || /LoginPage/.test(entry.fileName))).flatMap((entry) => ['/' + entry.fileName, ...entry.imports.map((name) => '/' + name)]);
      precache.push(...assets.filter((name) => name.endsWith('.css') && /index-|LoginPage/.test(name)));
      const version = createHash('sha256').update(assets.join('|')).digest('hex').slice(0, 16);
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: serviceWorkerSource({ assets, precache, version }) });
    }
  };
}

export default defineConfig({
  plugins: [react(), staticPwa()],
  build: { rollupOptions: { output: { manualChunks: (id) => {
    if (id.includes('node_modules') && /react|scheduler/.test(id)) return 'react-vendor';
    if (id.includes('node_modules')) return 'vendor';
  } } } },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});

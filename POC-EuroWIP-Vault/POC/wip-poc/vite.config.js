import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// `base: './'` keeps every asset reference relative, so the same build works from
// https://<user>.github.io/, https://<user>.github.io/<repo>/ or a local file
// server without a rebuild. GitHub Pages project sites are served from a
// sub-path, which an absolute base would break.
export default defineConfig({
  plugins: [svelte()],
  base: './',
  server: { port: 5173 },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    // The SQLite wasm blob is ~650 kB; inlining it would bloat the JS chunk.
    assetsInlineLimit: 4096
  },
  optimizeDeps: {
    exclude: ['sql.js'],
    include: ['sql.js/dist/sql-wasm.js']
  }
});

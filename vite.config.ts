import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    // TanStack Start — SSR + static prerendering so search engines AND AI crawlers
    // (GPTBot/ClaudeBot/PerplexityBot, which do NOT execute JS) get fully-rendered
    // HTML on the first request. `prerender` emits crawlable static HTML at build time.
    // NOTE: the Start plugin MUST come before the React plugin.
    tanstackStart({
      prerender: {
        enabled: true,
        // Follow in-app links from the prerendered entry to statically render
        // every reachable route.
        crawlLinks: true,
        // CRITICAL: do NOT fail the build when a crawled link 404s. Broken /
        // example / dynamic / auth-gated links are common, and `crawlLinks`
        // follows ALL of them — without this, ONE dead link aborts the whole
        // build → no dist/ → "404 NoSuchKey index.html" white screen. Skip + warn.
        failOnError: false,
      },
    }),
    viteReact(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
    // @blinkdotnew/ui + framer-motion + R3F peers must share one React instance or hooks
    // crash inside motion with: Cannot read properties of null (reading 'useRef')
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'framer-motion'],
  },
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    allowedHosts: true,
    // Dev proxy: the frontend calls the API with same-origin relative paths
    // (/products, /upload, /uploads, /health); Vite forwards them to the local
    // API. This keeps requests same-origin in the browser (no wrong-host /
    // mixed-content failures). Override the target with VITE_DEV_API_PROXY.
    proxy: Object.fromEntries(
      ['/products', '/upload', '/uploads', '/health'].map((p) => [
        p,
        {
          target: process.env.VITE_DEV_API_PROXY || 'http://localhost:4000',
          changeOrigin: true,
        },
      ]),
    ),
  },
  build: {
    // Build into a clean temp dir; scripts/finalize-static-build.mjs then flattens
    // .vite-out/client/* -> dist/ so Blink hosting serves dist/index.html
    // (BUILD_PATHS['vite-react'] = 'dist'). Building here instead of dist/ dodges the
    // EACCES from Start's client build emptying the platform-prepared dist/, which
    // pre-injects a read-only _redirects the sandbox user can't unlink.
    outDir: '.vite-out',
    emptyOutDir: true,
    // This small offline-first PWA ships as a single bundle (~231 kB gzip) on
    // purpose — fewer requests suit the two-tablet, often-offline deployment.
    // Raise the advisory limit to match that deliberate choice.
    chunkSizeWarningLimit: 1000,
  },
});

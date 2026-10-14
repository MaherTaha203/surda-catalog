import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import path from 'path';

// External Google Fonts @imports (from the self-hosted Tajawal setup and the
// bundled @blinkdotnew/ui theme sheets) are stripped by a PostCSS plugin — see
// postcss.config.cjs — which sees every @import-inlined file, unlike a Vite
// module transform.

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
      // SPA SHELL — the root fix for the React #418 hydration mismatch on deep
      // links (e.g. opening/refreshing /product/:id directly). Dynamic routes
      // are NOT prerendered (their data is per-id and comes from the API), so the
      // static host must return SOME html for them. Previously that was the `/`
      // prerender (the landing spinner); the client then hydrated the product
      // route against the landing DOM → mismatch. This emits `dist/_shell.html`:
      // a route-AGNOSTIC document that renders the root layout with an empty
      // router outlet (no route-specific server markup). The client hydrates that
      // same empty shell on ANY url, then resolves the real route on the client —
      // no server/client divergence, so no #418. The real content still comes
      // from the client exactly as before (every page here is already
      // client-gated), so local-first / offline / speed are unchanged. The
      // prerendered `/` and `/catalog` documents are still emitted for crawlers.
      spa: {
        enabled: true,
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
      // '/notifications-api' below is the EXPERIMENTAL notifications feature — remove it to delete the feature.
      ['/products', '/upload', '/uploads', '/health', '/catalog-settings', '/notifications-api'].map((p) => [
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

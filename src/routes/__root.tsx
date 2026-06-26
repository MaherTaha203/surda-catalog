/// <reference types="vite/client" />
import {
  HeadContent,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BlinkUIProvider, Toaster } from '@blinkdotnew/ui'
import type { ReactNode } from 'react'
import indexCss from '../index.css?url'

const queryClient = new QueryClient()

/**
 * Root route — owns the HTML document (SSR), global <head> (SEO-ready),
 * and the app-wide providers.
 *
 * NO app chrome (sidebar/top bar) is applied here by default, so every app —
 * landing pages, marketing sites, content, games — renders FULL-BLEED.
 * Building a SaaS / dashboard app? Opt into the sidebar shell by ADDING a
 * `src/routes/_app.tsx` pathless layout route with pages under `src/routes/_app/`
 * (a `_app.tsx` with no children conflicts with this index route). Keep this
 * root bare — don't add chrome here.
 *
 * SEO/AEO: <HeadContent /> renders the merged head() output (title, meta,
 * Open Graph, links) on the server, so crawlers and AI bots receive a
 * fully-rendered, indexable document on the first request. Per-page routes
 * override title/description via their own head().
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes' },
      { title: 'سردا — كتالوج المنتجات' },
      { name: 'description', content: 'كتالوج منتجات شركة سردا للتجارة والصناعة - مواد وأدوات التنظيف' },
      { name: 'theme-color', content: '#1a4a5e' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { name: 'apple-mobile-web-app-title', content: 'سردا' },
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: 'سردا — كتالوج المنتجات' },
      { property: 'og:description', content: 'كتالوج منتجات شركة سردا للتجارة والصناعة' },
      { property: 'og:site_name', content: 'شركة سردا' },
      { property: 'og:locale', content: 'ar_SA' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
    links: [
      { rel: 'stylesheet', href: indexCss },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'apple-touch-icon', href: '/icons/icon-192.png' },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                { '@type': 'WebSite', name: 'سردا — كتالوج المنتجات', url: '/' },
                { '@type': 'Organization', name: 'شركة سردا للتجارة والصناعة', url: '/', sameAs: [] },
              ],
            }),
          }}
        />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <BlinkUIProvider theme="minimal" darkMode="light">
            <Toaster />
            {/*
              Full-bleed by default — NO app chrome. Child routes render directly.
              SaaS / dashboard app? Opt in by adding a `src/routes/_app.tsx` layout
              route with pages under `src/routes/_app/`. Landing pages, marketing
              sites, content, and games stay full-bleed.
            */}
            {children}
          </BlinkUIProvider>
        </QueryClientProvider>
        <Scripts />
        <script
          dangerouslySetInnerHTML={{
            __html: `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js').catch(function() {});
  });
}
`,
          }}
        />
      </body>
    </html>
  )
}

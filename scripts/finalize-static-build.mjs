/**
 * Flatten the TanStack Start build into a static `dist/` that Blink hosting serves.
 *
 * TanStack Start's `vite build` (configured with `build.outDir: '.vite-out'`)
 * emits:
 *   .vite-out/client/   ← prerendered HTML + assets (what we want, STATIC)
 *   .vite-out/server/   ← SSR Nitro server (NOT used by Blink's static S3 hosting)
 *
 * Blink uploads `dist/` and serves `dist/index.html` (see src/constants/publish.ts
 * BUILD_PATHS['vite-react'] = 'dist'). So we copy `.vite-out/client/*` up into a
 * flat `dist/` and drop the server.
 *
 * Why build into `.vite-out` instead of `dist/` directly: the platform pre-injects
 * `dist/.../​_redirects` (the SPA fallback) owned by another user, and Start's client
 * build tries to EMPTY its out dir first → `EACCES: unlink _redirects`. Building into
 * a clean temp dir avoids that entirely; here we only COPY into `dist/` (never delete),
 * so a pre-existing read-only `_redirects` is tolerated.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = '.vite-out/client'
const DEST = 'dist'

if (!existsSync(SRC)) {
  console.error(`[finalize] build output missing: ${SRC} — did "vite build" run?`)
  process.exit(1)
}

mkdirSync(DEST, { recursive: true })

for (const entry of readdirSync(SRC)) {
  try {
    cpSync(join(SRC, entry), join(DEST, entry), { recursive: true, force: true })
  } catch (e) {
    // ONLY the platform-pre-injected `_redirects` may be skipped: it's read-only,
    // already in dist/, and byte-identical to ours. ANY other failed entry (assets/,
    // index.html, route html) would leave dist/index.html pointing at missing or
    // stale hashed assets — a silently broken deployment. Fail the build instead.
    if (entry === '_redirects') {
      console.warn(`[finalize] skip ${entry}: ${e.code || e.message} (pre-injected, identical content)`)
    } else {
      console.error(`[finalize] FAILED copying ${entry} into dist/: ${e.code || e.message} — aborting (a partial dist/ deploys broken)`)
      process.exit(1)
    }
  }
}

rmSync('.vite-out', { recursive: true, force: true })

// The app renders exclusively in Tajawal, but @blinkdotnew/ui's theme CSS also
// @imports four Google Font families the catalog never uses (Inter, Nunito,
// Space Grotesk, Plus Jakarta Sans). Strip those imports from the built CSS —
// five network requests fewer on every first load in the field.
// Safety net: the app self-hosts its fonts (src/fonts.css), so no external
// Google Fonts request should ever reach the built CSS. Strip any that sneaks
// back in (e.g. a re-added @import) — an offline-first PWA must not depend on
// an external font host.
const assetsDir = join(DEST, 'assets')
if (existsSync(assetsDir)) {
  let stripped = 0
  for (const file of readdirSync(assetsDir)) {
    if (!file.endsWith('.css')) continue
    const path = join(assetsDir, file)
    const css = readFileSync(path, 'utf8')
    const cleaned = css.replace(
      /@import (?:url\()?["']?https:\/\/fonts\.googleapis\.com\/[^"');]*["']?\)?;?/g,
      () => ((stripped++), ''),
    )
    if (cleaned !== css) writeFileSync(path, cleaned)
  }
  if (stripped > 0) console.log(`[finalize] ✓ stripped ${stripped} stray external Google Font import(s)`)
}

if (!existsSync(join(DEST, 'index.html'))) {
  console.error('[finalize] dist/index.html missing after flatten — build is not publishable')
  process.exit(1)
}

console.log('[finalize] ✓ static build flattened to dist/ (dist/index.html ready)')

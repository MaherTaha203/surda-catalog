# Known Limitations

1. **`@blinkdotnew/ui` still in use.** Only the Blink **data SDK** (`@blinkdotnew/sdk`) was
   removed. The UI library still provides the app provider, toaster, and theme tokens
   (`__root.tsx`, admin toasts, `index.css`). Replacing it (e.g. `react-hot-toast` + local
   tokens) is a separate effort, deferred to avoid UI regressions. The app has **no
   operational dependency on Blink** for data, images, or runtime.

2. **Authentication is a client-side PIN gate only.** PINs live in `localStorage` and are
   compared in the browser; the API itself has no auth. It deters casual access on a shared
   tablet — it is **not** real security. Run the API on a trusted network behind HTTPS; add
   real auth if it must be exposed.

3. **No settings UI.** `/settings` is a stub. Changing PINs or the company logo requires
   editing `localStorage` keys (see `ADMIN_GUIDE.md`).

4. **Lint tooling is incomplete.** `eslint` is not installed and `npm run lint` references two
   CSS-check scripts that don't exist. **TypeScript (`tsc --noEmit`) is the active type gate**
   and passes for both the app and the server.

5. **Image URL origin.** `imageUrl` is stored relative and resolved against `VITE_API_URL` at
   runtime. In split-origin deployments `VITE_API_URL` must be set at build time; prefer
   same-origin in production (then build with `VITE_API_URL=""`).

6. **No schema migration framework.** Schema changes are hand-applied in
   `server/src/database/schema.ts`; coordinate with `src/types/product.ts`.

7. **Data migration off Blink is no longer in the repo.** The Blink→SQLite migration tool was
   removed once the cut-over completed. If a live Blink dataset still needs importing, run it
   from the `claude/phase-5-data-migration` branch **before** decommissioning Blink. (In this
   environment Blink's host was network-blocked, so only synthetic data was exercised.)

8. **Single-tenant by design.** One administrator, one catalog, two tablets. No multi-user
   accounts, roles, or audit log.

## Future improvements
- Replace `@blinkdotnew/ui`; remove the last Blink package.
- Implement the `/settings` page (PIN + logo management).
- Add real server-side auth if the API is exposed beyond a trusted network.
- Optional image compression/resize on upload (e.g. `sharp`).
- Repair/replace the lint pipeline (eslint config) for CI.
- Route-level code-splitting to shrink the initial bundle.
- A lightweight migrations mechanism for future schema changes.

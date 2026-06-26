# `server/sync/` — Data migration + automatic synchronization (future)

> **Status: scaffolding only.** No sync code exists yet.

## Future responsibility

Two related jobs:

1. **One-time migration from Blink** (runs only during cutover): move all data and images
   **out of Blink** into the new SQLite `database/` + local `storage/` — without downtime
   or data loss.
2. **Automatic synchronization** (ongoing, per the decided architecture): keep the two
   Android tablets and the Fastify/SQLite server in sync. The PWA is offline-first, so
   edits made by the single administrator while offline must reconcile with the server
   automatically on reconnect, and the catalog must stay readable with no connectivity
   (backed by the existing IndexedDB cache in `src/lib/offline-db.ts`).

## Planned migration steps (detail in `../../MIGRATION_PLAN.md`)

1. **Export products from Blink** via the existing `list()` call, or via
   `src/lib/backup.ts` which already produces a JSON backup with base64-embedded images.
2. **Create the `products` table** in SQLite (schema in `server/database/`).
3. **Copy images** into the local uploads folder (`server/storage/`) and capture their
   served public URLs.
4. **Insert rows** with `imageUrl` rewritten to the new URLs; preserve `id`,
   `sortOrder`, `isHidden`, `createdAt`, `updatedAt` exactly.
5. **Verify counts and ordering** match the Blink source before cutover.

## Safety principles

- Keep Blink **read-only / untouched** as the source of truth until verification passes.
- Migration must be **idempotent** where possible (re-running shouldn't duplicate rows
  or images).
- Preserve `id`s so deep links like `/product/$id` keep working after migration.
- Do not run any sync that mutates Blink; this phase only reads from it.

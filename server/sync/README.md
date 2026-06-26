# `server/sync/` — Data & image migration from Blink (future)

> **Status: scaffolding only.** No sync code exists yet. Runs only during cutover.

## Future responsibility

One-time (and, if needed, repeatable) migration of all data and images **out of Blink**
and into the new `database/` + `storage/` backends — without downtime or data loss.

## Planned migration steps (detail in `../../MIGRATION_PLAN.md`)

1. **Export products from Blink** via the existing `list()` call, or via
   `src/lib/backup.ts` which already produces a JSON backup with base64-embedded images.
2. **Create the `products` table** on the new backend (schema in `server/database/`).
3. **Re-upload images** to the new `storage/` bucket and capture the new public URLs.
4. **Insert rows** with `imageUrl` rewritten to the new URLs; preserve `id`,
   `sortOrder`, `isHidden`, `createdAt`, `updatedAt` exactly.
5. **Verify counts and ordering** match the Blink source before cutover.

## Safety principles

- Keep Blink **read-only / untouched** as the source of truth until verification passes.
- Migration must be **idempotent** where possible (re-running shouldn't duplicate rows
  or images).
- Preserve `id`s so deep links like `/product/$id` keep working after migration.
- Do not run any sync that mutates Blink; this phase only reads from it.

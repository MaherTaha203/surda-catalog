# `server/` — Future backend (Blink replacement)

> **Status: scaffolding only.** This folder is intentionally empty of logic in Phase 2.
> Nothing here is wired into the app yet. Blink is still the live backend.

## Why this exists

Per `PROJECT_AUDIT.md`, the app currently depends on the **Blink platform** for three
things:

1. **Database** — a single `products` table (`blink.db`).
2. **Storage** — product image uploads returning a public URL (`blink.storage`).
3. **UI kit + toasts** — `@blinkdotnew/ui` (handled on the client, not here).

`blink.auth` is **not used** — there is no real server-side auth to replace.

This `server/` tree is the home for the **self-hosted / provider-backed replacement**
that will eventually take over the database and storage responsibilities, so that
`@blinkdotnew/sdk` can be removed without losing functionality.

## Sub-folders (each has its own README)

| Folder | Future responsibility |
|---|---|
| `api/` | HTTP endpoints the frontend calls instead of `blink.db` / `blink.storage`. |
| `database/` | Schema, migrations, and the data-access layer for the `products` table. |
| `storage/` | Image upload/serve logic; produces the public URLs stored in `products.imageUrl`. |
| `sync/` | One-time + ongoing data/image migration from Blink to the new backend. |
| `config/` | Environment, secrets, and backend connection configuration. |

## Hard rules during preparation (Phase 2)

- **Do not** import anything from `server/` into `src/` yet.
- **Do not** remove or modify Blink usage in `src/`.
- The contract to preserve is the `Product` shape and the operations documented in
  `PROJECT_AUDIT.md` §5/§8: `list({ orderBy: { sortOrder } })`, `get(id)`,
  `create`, `update`, `delete`, and `upload(file) -> { publicUrl }`.

See `../MIGRATION_PLAN.md` for the exact order in which Blink will be removed.

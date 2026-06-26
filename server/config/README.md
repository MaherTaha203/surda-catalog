# `server/config/` — Backend configuration (future)

> **Status: scaffolding only.** No config code exists yet.

## Future responsibility

Centralize the configuration and secrets for the new backend (`database/`, `storage/`,
`api/`) so connection details live in one place and are sourced from environment
variables — never hardcoded.

## Why this matters (see `PROJECT_AUDIT.md` §5 / §10)

The current Blink client hardcodes fallback credentials in `src/blink/client.ts`:

```ts
projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'sarda-catalog-pwa-k9uwa31b',
publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_…',
```

The replacement must **not** repeat this anti-pattern. New backend keys/URLs come from
env (e.g. `VITE_*` for anything the client needs, server-only secrets for the rest).

## Planned contents

- SQLite database file path.
- Local uploads folder path + the public base URL Fastify serves it under.
- Fastify host/port and any client-facing base URL.
- Environment loading/validation (fail fast if required vars are missing).
- A documented `.env.example` listing every required variable.

## Rules

- Secrets never committed; only `.env.example` placeholders.
- Client-exposed values must use the `VITE_` prefix; everything else stays server-side.

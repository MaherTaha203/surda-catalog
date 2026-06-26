# `src/api/` — Frontend API client (future)

> **Status: scaffolding only.** Empty in Phase 2. No HTTP client is wired yet.

## Future responsibility

Hold the **client-side functions that talk to `server/api/`** over HTTP. This is the
concrete implementation that the new (non-Blink) `src/services/` adapter will call.

Think of it as the thin fetch layer:

- builds requests to the backend endpoints,
- handles JSON parsing and error normalization,
- knows the base URL / headers from config.

## Planned functions (mirror `server/api/` endpoints)

| Function | Calls | Returns |
|---|---|---|
| `fetchProducts()` | `GET /products` | `Product[]` |
| `fetchProduct(id)` | `GET /products/:id` | `Product \| null` |
| `createProduct(data)` | `POST /products` | `Product` |
| `updateProduct(id, data)` | `PATCH /products/:id` | `Product` |
| `deleteProduct(id)` | `DELETE /products/:id` | `void` |
| `uploadImage(file)` | `POST /uploads` | `{ publicUrl }` |

## Relationship to other layers

```
routes / components
        │  (use)
        ▼
  src/services/   ← backend-agnostic repository interface
        │  (new-backend adapter delegates to)
        ▼
   src/api/       ← HTTP client  ──────►  server/api/  ──►  server/{database,storage}
```

## Rules

- No business logic here — just request/response plumbing.
- Response objects must conform to `src/types/product.ts`.
- Not activated in Phase 2; Blink remains the live data path.

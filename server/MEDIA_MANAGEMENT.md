# Media Management v1.1

An operational management + observability layer **on top of** the existing Image
Processing Engine (v1.0). It does not change how images are uploaded, processed,
or served — it cross-references the `products` table against the files on disk
and lets an operator report on, and repair, any drift.

> Scope rule honoured: this is **not** a rewrite of the image engine. No API
> contract, database schema, route behaviour, model, PWA, or frontend was
> changed. Every addition is isolated and individually reviewable.

---

## 1. Architecture

```
                    products table (source of truth: imageUrl)
                              │
        ┌─────────────────────┴──────────────────────┐
        │              MediaService                    │   ← all logic here
        │  scanGarbage / collectGarbage                │
        │  checkIntegrity                              │
        │  findDuplicates (SHA-256)                    │
        │  regenerateThumbnails  ─────────────┐        │
        │  collectStats                       │        │
        └──────────┬───────────────┬──────────┼────────┘
                   │               │          │
   read-only HTTP  │           CLI │   StorageService.regenerateThumbnail
   /admin/media/*  │   npm run media│   (same Sharp pipeline + memory gate)
                   ▼               ▼
            observability     gc --execute / thumbnails  (mutating, CLI-only)
```

- **Source of truth.** "In use" is derived exactly as the rest of the app already
  interprets it: a product's local image is `imageUrl` starting with
  `/uploads/products/`, and its thumbnail is the same basename under
  `/uploads/thumbs/` (the thumbnail-by-convention the upload engine and
  `deleteByUrl` already use). No new column, no new table.
- **Two surfaces, by risk.** Read-only reporting is exposed over HTTP
  (`/admin/media/*`). The destructive/mutating operations (garbage **execute**,
  thumbnail **regeneration**) are exposed **only** through the CLI, so they can
  never be triggered by a stray GET.
- **One image pipeline.** Thumbnail regeneration calls
  `StorageService.regenerateThumbnail`, which reuses the *exact* upload-time
  thumbnail pipeline and the same concurrency gate. A regenerated thumbnail is
  byte-for-byte what the original upload produced — no drift, bounded memory.

---

## 2. Engineering decisions (and why)

| Decision | Why |
|---|---|
| **No schema change** | The rule was "only if there's a clear benefit". File↔product linkage is already fully expressed by `imageUrl` + the thumb convention; a `media` table would duplicate that and add a sync-burden for zero new capability. |
| **Read-only HTTP, mutating CLI** | Deleting files and rebuilding thumbnails are maintenance actions for the single admin, not request-path features. Keeping them off HTTP removes a whole class of accident/abuse, and needs no auth layer (the API has none today). |
| **Dry-Run first for GC** | `scanGarbage` / `gc` (no flag) only reports. Deletion needs the explicit `--execute`. GC deletes **orphans only** — never a referenced image and never a "missing" reference (which signals a problem to investigate, not delete). |
| **SHA-256 for duplicates** | Content hash is exact and collision-safe for this purpose; it catches identical bytes regardless of filename. Reports only — it never auto-deletes, because two products may legitimately point at copies. |
| **Single-source-of-truth pipeline** | Exporting the pipeline functions/params from `storage.ts` (instead of re-implementing the Sharp calls in the media layer) guarantees regenerated thumbnails match upload output and that a future quality/size change updates both paths at once. |
| **In-process metrics** | `processed / rejected / failed / avgProcessingMs` are lightweight counters in `storage.ts`, surfaced via stats. They answer "is processing healthy?" with no persistence cost. They reset on restart by design (operational, not historical). |
| **Header-only type sniffing** | Stats/integrity read just the first 12 bytes to identify a file's true format, so a 1000-image scan doesn't read gigabytes. |

---

## 3. New files

| File | Purpose |
|---|---|
| `server/src/services/media.ts` | `MediaService`: GC, integrity, duplicates, thumbnail regen, stats. All filesystem/DB cross-referencing lives here. |
| `server/src/routes/media.ts` | Read-only admin routes `GET /admin/media/{stats,garbage,integrity,duplicates}`. |
| `server/scripts/media.ts` | `npm run media -- <cmd>` CLI (incl. the mutating `gc --execute` and `thumbnails`). |
| `server/MEDIA_MANAGEMENT.md` | This document. |

**Touched (additive only):**
- `server/src/services/storage.ts` — exported `sniffImageType` + the image-pipeline
  params, extracted the full/thumb pipelines into shared functions, added
  in-process `ImageMetrics`, and added `StorageService.regenerateThumbnail()`.
  `saveImage` output is byte-identical (same Sharp operations, same gate).
- `server/src/app.ts` — registered the new read-only routes.
- `server/package.json` — added the `media` script.

---

## 4. Capabilities (the six phases)

1. **Garbage Collection** — classifies every file/reference into *orphans* (on disk,
   unreferenced → safe to delete), *missing* (referenced, absent on disk → needs
   attention), and *mismatched* (full/thumb pairs that don't line up). Dry-Run by
   default; `gc --execute` deletes orphans only.
2. **Image Integrity** — per referenced image: full exists, thumb exists, file
   readable, pixels decodable (Sharp), and magic-bytes match the `.webp`
   extension. Reports the unhealthy ones with specific problems.
3. **Duplicate Detection** — SHA-256 of every full image, grouped; reports
   duplicate groups, redundant-copy count, reference counts, and wasted bytes.
   Report-only.
4. **Thumbnail Regeneration** — rebuilds thumbnails from the full images, either
   `missing` (repair/recover) or `all` (e.g. a future thumbnail-size change),
   using the exact upload pipeline. Corrupt sources fail gracefully and are listed.
5. **Observability** — image/thumbnail counts, total + average sizes, largest
   image, file-type distribution, reference health, and the in-process processing
   metrics (processed / rejected / failed / avg ms). Via `GET /admin/media/stats`
   or `npm run media -- stats`.
6. **Benchmark** — see §5.

---

## 5. Performance (measured)

Synthetic stores with 5% orphans, 2% missing thumbs, and duplicates. Each
operation timed with peak RSS sampled in-process.

| Operation | N=100 | N=500 | N=1000 | Peak RSS |
|---|--:|--:|--:|--:|
| `scanGarbage` (GC scan) | 3 ms | 9 ms | 25 ms | ~118 MB (flat) |
| `checkIntegrity` (decode every image) | 83 ms | 371 ms | 733 ms | ~118 MB (flat) |
| `findDuplicates` (SHA-256 every file) | 31 ms | 146 ms | 280 ms | ~119 MB (flat) |
| `collectStats` | 37 ms | 180 ms | 353 ms | ~118 MB (flat) |
| `regenerateThumbnails(missing)` | 6 ms | 22 ms | 43 ms | ~119 MB (flat) |

**Key result:** time scales roughly linearly with image count and **memory stays
flat (~120 MB) regardless of N** — the scans are sequential/streaming, never
loading the whole library at once. Stable and comfortable at 1000 images, with
large headroom (the catalog is a few dozen products). `checkIntegrity` is the
heaviest because it Sharp-decodes every image; it's a maintenance action, not on
the request path.

---

## 6. Verification (no regression)

| Check | Result |
|---|---|
| Upload validation (empty / non-image / corrupt → 400; valid → 201 webp+thumb) | ✅ |
| New metrics counters (processed / rejected / failed) | ✅ processed=1, rejected=2, failed=1 |
| Replace + delete (fv4) | ✅ ALL PASS |
| Stress 100 uploads, no leak (fv5) | ✅ ALL PASS, RSS Δ+74 MB bounded |
| Browser admin CRUD + image upload (Playwright) | ✅ ALL PASS |
| `/admin/media/*` endpoints + existing `/health`, `/products` contracts | ✅ ALL PASS |
| Mutating ops absent over HTTP (POST → 404) | ✅ |
| Live CLI on 90-product store (stats/gc/integrity/duplicates) | ✅ 90/90 healthy, 0 orphans |
| Typecheck (`tsc --noEmit`) | ✅ clean |

`saveImage` produces byte-identical output (same Sharp operations, just factored
into shared functions), so the upload contract is unchanged.

---

## 7. Remaining risks

- **Metrics are per-process and reset on restart** (by design). The CLI runs in a
  separate process from the server, so CLI `stats` shows `processing: 0` — the
  live counters are on the server's `GET /admin/media/stats`. Persisting metrics
  would need a store; out of scope for v1.1.
- **`/admin/media/*` is unauthenticated**, consistent with the rest of the API
  (single-admin, client-side PIN). It is read-only and low-risk, but if the API is
  ever exposed beyond the LAN it should sit behind the same protection as the
  write endpoints.
- **GC `--execute` and `thumbnails --all` are point-in-time.** Run them when no
  upload is in flight (single-admin usage makes this trivial); they are not
  transactional against concurrent writes.
- **Duplicate detection is report-only.** Deduplication (repointing products to a
  single copy) is deliberately deferred — it would touch `imageUrl` and so needs a
  product-write, which belongs in a future, opt-in feature.

---

## 8. Recommendations for the next version

1. **Scheduled health report** — run `gc` + `integrity` on a timer (or a
   lightweight cron) and log/notify on anomalies, so drift is caught proactively.
2. **Safe de-duplication** — an opt-in command that repoints duplicate products to
   one canonical file and GCs the rest, inside a DB transaction.
3. **Optional `media` audit table** — only if historical metrics (processing time
   trends, rejection rates over weeks) become valuable; keep it append-only.
4. **`thumbnails --all` after any thumbnail-size change** — already supported;
   document it in the runbook as the migration step.
5. **Auth on `/admin/*`** if/when the deployment surface widens beyond the tablets.

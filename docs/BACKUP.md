# Backup

All catalog state lives in **two places** on the server:

1. **`catalog.db`** — the SQLite database (products).
2. **`uploads/products/`** — the product image files.

A backup must capture **both**, ideally at the same moment, so image references stay valid.

## What to back up
- `$CATALOG_DB_PATH` (default `server/catalog.db`) — and its WAL sidecars if present
  (`catalog.db-wal`, `catalog.db-shm`).
- `$UPLOADS_DIR` (default `server/uploads/products/`).

## Recommended: consistent SQLite backup
Use SQLite's online backup so you capture a consistent snapshot even while the server runs:

```bash
# database (consistent copy, includes WAL)
sqlite3 server/catalog.db ".backup '/backups/catalog-$(date +%F).db'"

# images
tar -czf "/backups/uploads-$(date +%F).tgz" -C server uploads/products
```

If you don't have the `sqlite3` CLI, stop the server briefly and copy the files instead:

```bash
cp server/catalog.db* /backups/          # db + WAL/SHM
tar -czf /backups/uploads.tgz -C server uploads/products
```

## Schedule
- Daily automated backups (cron) for a single-admin catalog are plenty.
- Keep a rolling set (e.g. 7 daily + 4 weekly) off the server (different disk/host).

## Verify
Periodically test a restore into a scratch directory (see `RESTORE.md`) and confirm the
product count and a few images load.

> Note: device-side PINs (`localStorage`) are **not** part of server backups. Record the
> chosen PINs separately.

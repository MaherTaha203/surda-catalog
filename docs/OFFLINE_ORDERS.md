# Offline orders and synchronization

This feature adds a separate order-taking domain without changing catalog product contracts.

## Data and safety guarantees
- Customers, orders, order items and idempotency records live in SQLite; schema creation is idempotent.
- Clients provide stable UUIDs for customers, orders, items, device IDs and mutation IDs.
- Every mutation has a `baseRevision`. If the server's current revision differs, the server returns `conflict` with the current order; it never silently overwrites a newer revision.
- Replayed mutation IDs return `duplicate` and the already-saved order, so retrying after a lost network response does not create a second order.
- Order numbers are assigned transactionally on first successful sync.
- Item names are snapshotted into the order; later catalog renames do not change historical printouts.
- Quantity must be a positive integer. The sync endpoint accepts at most 100 mutations per request.
- Order mutations and item replacement are atomic in SQLite.

## API
- `GET /customers?includeInactive=true`
- `POST /customers` with `{id,name,phone?,notes?}`
- `GET /orders?customerId=&from=YYYY-MM-DD&to=YYYY-MM-DD&search=`
- `GET /orders/:id`
- `POST /orders/sync` with `{mutations:[{mutationId,deviceId,baseRevision,order:{id,customerId,customerName,status,items:[{id,productId,productName,quantity,sortOrder}]}}]}`

The client must keep its durable local outbox until every mutation is explicitly acknowledged as applied or duplicate. A conflict must be surfaced for manual review; it must not be auto-resolved by last-write-wins.

## Deployment caveat
The backend uses SQLite and requires a persistent writable volume for `CATALOG_DB_PATH`. A stateless/ephemeral filesystem is not suitable for cross-device sync. Confirm persistent-volume configuration and backup/restore before production rollout.

## Current scope boundary
This commit provides the server-side data and synchronization foundation. It does not claim that offline browser storage, order-entry UI, or A4 print workflows are complete; those remain subsequent implementation and verification steps.

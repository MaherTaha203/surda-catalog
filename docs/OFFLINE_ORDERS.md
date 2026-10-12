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

## Frontend behavior currently implemented
- The `/orders` page keeps customers, order drafts, order items and a mutation outbox in IndexedDB.
- The catalog header links to order management. Product snapshot data is used as the offline fallback when the API cannot be reached.
- Quantity changes and status changes are saved locally and queued for sync; retries are idempotent.
- The A4 print view includes the customer, order number/date, product names and quantities only (no prices or totals). It prints the selected order, or the filtered order list if no order is selected.
- Orders downloaded from the server are added locally unless a local pending mutation or unresolved conflict exists.

## Verification and deployment limits
- Automated tests cover idempotent retries, revision conflicts, positive quantities, product-name snapshots and sequential order numbering. The added GitHub Actions workflow runs frontend/backend type checks, frontend build and backend tests.
- A green workflow result must be confirmed before calling this branch tested. This environment has not executed the build or tests itself.
- The UI displays conflict state but does not yet provide a guided merge/resolution flow; conflicts remain queued for manual review.
- Before production rollout, confirm the SQLite file is on persistent writable storage and test backup/restore on the actual host.

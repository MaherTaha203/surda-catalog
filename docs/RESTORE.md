# Restore

Restore the **database and images together** so `imageUrl` references resolve.

## Steps

1. **Stop the API server.**

2. **Restore the database** to `$CATALOG_DB_PATH`:
   ```bash
   cp /backups/catalog-YYYY-MM-DD.db server/catalog.db
   # remove stale WAL/SHM sidecars from the previous instance, if any
   rm -f server/catalog.db-wal server/catalog.db-shm
   ```

3. **Restore the images** to `$UPLOADS_DIR`:
   ```bash
   rm -rf server/uploads/products
   mkdir -p server/uploads
   tar -xzf /backups/uploads-YYYY-MM-DD.tgz -C server
   ```

4. **Start the server.** Schema is verified/created idempotently on boot; existing data is
   left intact.
   ```bash
   cd server && npm start
   ```

5. **Verify:**
   ```bash
   curl -s http://localhost:4000/products | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log('products:',JSON.parse(d).length))"
   # open the catalog and confirm a few images load
   ```

## Notes
- Always restore a **matching** db + images pair (same timestamp). A db referencing images
  that aren't restored will show broken thumbnails; orphan image files are harmless.
- The database file is portable across machines (plain SQLite); just keep Node 22+ on the
  target.
- Device PINs are not in server backups — re-set them in `localStorage` if needed
  (see `ADMIN_GUIDE.md`).

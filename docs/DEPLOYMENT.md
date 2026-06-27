# Deployment

The system has two deployables: the **static frontend** (`dist/`) and the **Fastify API**
(`server/`). They can run same-origin (recommended) or split-origin.

## Prerequisites
- Node.js 22+ (for `node:sqlite`).
- A persistent volume for `server/catalog.db` and `server/uploads/`.

## 1. Backend (Fastify + SQLite)

```bash
cd server
npm install
npm start            # tsx src/index.ts  → listens on PORT (default 4000)
```

The database and `products` table auto-create on first boot. Run behind a process manager
(systemd, pm2) and a reverse proxy with **HTTPS**.

### Environment
| Var | Default | Purpose |
|---|---|---|
| `PORT` | `4000` | listen port |
| `HOST` | `0.0.0.0` | listen host |
| `CATALOG_DB_PATH` | `./catalog.db` | SQLite file (use an absolute path on a volume) |
| `UPLOADS_DIR` | `./uploads/products` | image storage dir |
| `UPLOADS_PUBLIC_PREFIX` | `/uploads/products` | prefix written into `imageUrl` |
| `UPLOAD_MAX_BYTES` | `5242880` | max upload size (5 MB) |
| `CORS_ORIGIN` | reflect any | comma-separated allowed origins (restrict in prod) |
| `LOG_LEVEL` | `info` | Fastify log level |

## 2. Frontend (static PWA)

```bash
# from the repo root — same-origin (recommended): leave VITE_API_URL unset
npm install
npm run build              # → dist/ (relative API paths)
#   split-origin:  VITE_API_URL="https://api.example.com" npm run build
```

Host `dist/` on any static host/CDN with an **SPA fallback** (`/* → /index.html`, 200) so
client-rendered routes like `/product/:id` resolve. `public/_redirects` already encodes this
for Netlify-style hosts.

By default the frontend uses **same-origin relative** API paths — no host is baked into the
build. Choose one topology:

- **Same-origin (recommended):** serve `dist/` and the API under one origin (the reverse proxy
  routes `/products`, `/upload`, `/uploads`, `/health` to Fastify and everything else to the
  static files). Build with `VITE_API_URL` **unset** so API/image URLs stay relative.
- **Split-origin:** set `VITE_API_URL` to the API origin and `CORS_ORIGIN` to the frontend
  origin. `@fastify/helmet` is configured with `Cross-Origin-Resource-Policy: cross-origin`
  so images load across origins.

## 3. Tablets (PWA)
Open the frontend URL in Chrome on each tablet and **Add to Home screen**. The manifest +
service worker enable standalone, offline-capable operation.

## 4. Post-deploy checklist
- [ ] HTTPS in front of the API on a trusted network.
- [ ] `CORS_ORIGIN` restricted.
- [ ] Default PINs changed (see `ADMIN_GUIDE.md`).
- [ ] `catalog.db` + `uploads/` on a backed-up volume (see `BACKUP.md`).
- [ ] If migrating real data off Blink, run the migration first (see `KNOWN_LIMITATIONS.md`).

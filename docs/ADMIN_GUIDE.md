# Admin Guide (دليل المدير)

The admin panel lets a single administrator manage the catalog from a tablet or desktop.

## Signing in
1. Open the app. On the landing screen tap **لوحة المدير** (Admin panel).
2. Enter the **admin PIN**. Default: `4321` (change it — see below).
3. You land on the catalog with a **لوحة التحكم** shortcut; open it to manage products.

> PINs are stored on the device. The **display PIN** (default `1234`) only opens the catalog;
> the **admin PIN** unlocks management. This is a soft gate for shared tablets, not strong
> security — keep the app on a trusted network.

## Managing products (`/admin`)

### Add a product — **إضافة منتج**
- Choose a **category** (مواد التنظيف / أدوات التنظيف).
- Enter **name** (required), description, size (materials only), carton quantity, carton price (₪).
- Optionally upload an image (JPEG/PNG/WEBP/GIF, ≤ 5 MB).
- Tap **إضافة المنتج**. The product appears immediately.

### Edit — pencil icon
Change any field. Uploading a new image replaces the old one (the old file is deleted).

### Show / hide — eye icon
Hidden products stay in the database but don't appear in the customer catalog. A **مخفي**
badge marks them in the admin list.

### Reorder — ▲ / ▼ arrows (desktop/tablet width)
Move a product up or down. Order is saved atomically.

### Delete — trash icon
Confirms first, then removes the product **and its image file**. This cannot be undone.

## Notes
- Changes appear live; if the list ever looks stale, it auto-refreshes after each action.
- If the server is unreachable, the admin list shows an error with a **retry** button.

## Changing PINs
There is currently **no settings UI** (the `/settings` page is a stub). To change PINs, set
these keys in the browser's `localStorage` on the device (DevTools → Application → Local
Storage) and reload:
- `sarda_display_pin` — catalog PIN
- `sarda_admin_pin` — admin PIN

(Adding a settings screen is a planned improvement — see `KNOWN_LIMITATIONS.md`.)

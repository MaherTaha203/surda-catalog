/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Public surface of the feature. The rest of the app imports ONLY from here
 * (plus the thin route bridge src/routes/notifications.tsx), so deleting the
 * feature is: remove this folder, the route bridge, and the handful of lines
 * marked `[notifications-feature]`. See README.md.
 */
export { NotificationBell } from './NotificationBell';
export { NotificationSourceBar } from './NotificationSourceBar';
export { AdminNotificationsPage } from './AdminNotificationsPage';

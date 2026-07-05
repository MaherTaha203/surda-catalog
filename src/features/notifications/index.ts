/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Public surface of the feature. The rest of the app imports ONLY from here
 * (plus the thin route bridges src/routes/notifications.tsx and
 * src/routes/notifications-history.tsx). Deleting the feature = remove this
 * folder, the two route bridges, and the `[notifications-feature]` lines.
 */
export { NotificationBell } from './NotificationBell';
export { NotificationSourceBar } from './NotificationSourceBar';
export { AdminNotificationsPage } from './AdminNotificationsPage';
export { NotificationHistoryPage } from './NotificationHistoryPage';

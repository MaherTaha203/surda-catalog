/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Thin route bridge only. All logic lives in src/features/notifications/.
 * TanStack Router requires route files under src/routes/, so this file just
 * mounts the feature's admin page. Delete it (and the feature folder) to remove
 * the feature — see src/features/notifications/README.md.
 */
import { createFileRoute } from '@tanstack/react-router';
import { AdminNotificationsPage } from '@/features/notifications';

export const Route = createFileRoute('/notifications')({
  head: () => ({ meta: [{ title: 'الإشعارات — سردا' }] }),
  component: AdminNotificationsPage,
});

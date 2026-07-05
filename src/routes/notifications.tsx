/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Thin route bridge only. All logic lives in src/features/notifications/.
 * Delete this file (and the feature folder) to remove the feature — see
 * src/features/notifications/README.md.
 */
import { createFileRoute } from '@tanstack/react-router';
import { AdminNotificationsPage } from '@/features/notifications';

export const Route = createFileRoute('/notifications')({
  head: () => ({ meta: [{ title: 'الإشعارات — سردا' }] }),
  // Optional `?edit=<id>` deep-links the dashboard into edit mode (from history).
  validateSearch: (search: Record<string, unknown>): { edit?: string } => {
    const edit = typeof search.edit === 'string' ? search.edit : undefined;
    return edit ? { edit } : {};
  },
  component: AdminNotificationsPage,
});

/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Thin route bridge for the notification history page (spec §8). All logic lives
 * in src/features/notifications/. Delete this file to remove the history route.
 */
import { createFileRoute } from '@tanstack/react-router';
import { NotificationHistoryPage } from '@/features/notifications';

export const Route = createFileRoute('/notifications-history')({
  head: () => ({ meta: [{ title: 'سجل الإشعارات — سردا' }] }),
  component: NotificationHistoryPage,
});

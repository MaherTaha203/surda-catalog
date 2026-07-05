/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * React Query hooks. Polling is 30s (spec: no WebSocket, poll every 30s).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsClient } from '@/hooks/useIsClient';
import {
  listAllNotifications,
  listDeviceNotifications,
  markNotificationRead,
  markNotificationDone,
} from './api';
import { getDeviceId } from './device';
import type { Notification } from './types';

/** All keys live under ['notifications'] so one invalidate refreshes everything. */
export const NOTIFICATIONS_KEY = ['notifications'] as const;
/** Manager "all notifications" query key. */
export const NOTIFICATIONS_ALL_KEY = [...NOTIFICATIONS_KEY, 'all'] as const;

const POLL_MS = 30_000;

/** Delegate feed for this device (polled every 30s). */
export function useDeviceNotifications() {
  const isClient = useIsClient();
  const deviceId = isClient ? getDeviceId() : 'all';
  return useQuery<Notification[]>({
    queryKey: [...NOTIFICATIONS_KEY, 'device', deviceId],
    queryFn: () => listDeviceNotifications(deviceId),
    enabled: isClient,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
    // Reopening / returning to the catalog shows the current badge at once, so a
    // rep never stares at a stale count while waiting for the 30s poll tick.
    refetchOnMount: 'always',
  });
}

/** Manager feed — all notifications (polled every 30s). */
export function useAllNotifications(enabled = true) {
  const isClient = useIsClient();
  return useQuery<Notification[]>({
    queryKey: NOTIFICATIONS_ALL_KEY,
    queryFn: listAllNotifications,
    enabled: enabled && isClient,
    refetchInterval: POLL_MS,
    refetchOnMount: 'always',
  });
}

/** Replace a notification by id across every cached list (manager + device). */
function patchCachedNotification(qc: ReturnType<typeof useQueryClient>, updated: Notification) {
  qc.setQueriesData<Notification[]>({ queryKey: NOTIFICATIONS_KEY }, (old) =>
    Array.isArray(old) ? old.map((n) => (n.id === updated.id ? updated : n)) : old,
  );
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    // Apply the server's row immediately (no wait for the 30s poll), then
    // reconcile. Keeps the unread badge correct the instant a notification opens.
    onSuccess: (updated) => {
      patchCachedNotification(qc, updated);
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMarkDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => markNotificationDone(id),
    onSuccess: (updated) => {
      patchCachedNotification(qc, updated);
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

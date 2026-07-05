/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * React Query hooks. Polling is 30s (spec §16: no WebSocket).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useIsClient } from '@/hooks/useIsClient';
import {
  listAllNotifications,
  listDeviceNotifications,
  getNotification,
  listDevices,
  markNotificationRead,
  markNotificationCompleted,
  createNotification,
  editNotification,
  deleteNotification,
  cancelNotification,
  registerDevice,
  type NotificationInput,
} from './api';
import { getDeviceId } from './device';
import type { Notification, Device } from './types';

export const NOTIFICATIONS_KEY = ['notifications'] as const;
export const NOTIFICATIONS_ALL_KEY = [...NOTIFICATIONS_KEY, 'all'] as const;
export const DEVICES_KEY = [...NOTIFICATIONS_KEY, 'devices'] as const;

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

/** A single notification (used by the product page's "from notification" bar). */
export function useNotification(id: string | undefined) {
  const isClient = useIsClient();
  const qc = useQueryClient();
  return useQuery<Notification | null>({
    queryKey: [...NOTIFICATIONS_KEY, 'one', id],
    queryFn: () => getNotification(id as string),
    enabled: isClient && !!id,
    // Paint instantly from any cached list while the fresh fetch runs.
    placeholderData: () => {
      for (const [, data] of qc.getQueriesData<Notification[]>({ queryKey: NOTIFICATIONS_KEY })) {
        const hit = Array.isArray(data) ? data.find((n) => n.id === id) : undefined;
        if (hit) return hit;
      }
      return undefined;
    },
  });
}

/** Registered devices (manager dropdown). */
export function useDevices(enabled = true) {
  const isClient = useIsClient();
  return useQuery<Device[]>({
    queryKey: DEVICES_KEY,
    queryFn: listDevices,
    enabled: enabled && isClient,
    refetchOnMount: 'always',
  });
}

/** Replace a notification by id across every cached list (manager + device). */
function patchCached(qc: ReturnType<typeof useQueryClient>, updated: Notification) {
  qc.setQueriesData<Notification[]>({ queryKey: NOTIFICATIONS_KEY }, (old) =>
    Array.isArray(old) ? old.map((n) => (n.id === updated.id ? updated : n)) : old,
  );
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deviceId }: { id: string; deviceId: string }) => markNotificationRead(id, deviceId),
    onSuccess: (updated) => {
      patchCached(qc, updated);
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useMarkCompleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, deviceId }: { id: string; deviceId: string }) => markNotificationCompleted(id, deviceId),
    onSuccess: (updated) => {
      patchCached(qc, updated);
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useCreateNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NotificationInput) => createNotification(input),
    onSuccess: (created) => {
      qc.setQueryData<Notification[]>(NOTIFICATIONS_ALL_KEY, (old) =>
        old && !old.some((n) => n.id === created.id) ? [created, ...old] : old,
      );
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useEditNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: NotificationInput }) => editNotification(id, input),
    onSuccess: (updated) => {
      patchCached(qc, updated);
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useDeleteNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: (_v, id) => {
      qc.setQueriesData<Notification[]>({ queryKey: NOTIFICATIONS_KEY }, (old) =>
        Array.isArray(old) ? old.filter((n) => n.id !== id) : old,
      );
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useCancelNotification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelNotification(id),
    onSuccess: (updated) => {
      patchCached(qc, updated);
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

export function useRegisterDevice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ deviceId, deviceName }: { deviceId: string; deviceName: string }) =>
      registerDevice(deviceId, deviceName),
    onSuccess: () => qc.invalidateQueries({ queryKey: DEVICES_KEY }),
  });
}

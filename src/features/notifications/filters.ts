/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Filtering + device-name resolution shared by the dashboard and history pages.
 */
import { TYPE_LABELS, type Device, type Notification, type NotificationStatus, type NotificationType } from './types';

/** Build a device_id → friendly name resolver from the registry. */
export function makeDeviceNameResolver(devices: Device[]): (deviceId: string | null) => string {
  const map = new Map(devices.map((d) => [d.device_id, d.device_name]));
  return (deviceId) => {
    if (!deviceId) return '—';
    if (deviceId === 'all') return 'كل الأجهزة';
    return map.get(deviceId) || deviceId;
  };
}

export interface NotificationFilter {
  status?: NotificationStatus | 'all';
  type?: NotificationType | 'all';
  /** Free text over title, message, recipient name, and date. */
  search?: string;
}

export function filterNotifications(
  list: Notification[],
  filter: NotificationFilter,
  deviceName: (id: string | null) => string,
): Notification[] {
  const q = (filter.search ?? '').trim().toLowerCase();
  return list.filter((n) => {
    if (filter.status && filter.status !== 'all' && n.status !== filter.status) return false;
    if (filter.type && filter.type !== 'all' && n.type !== filter.type) return false;
    if (!q) return true;
    const haystack = [
      n.title,
      n.message,
      TYPE_LABELS[n.type],
      n.device_name,
      deviceName(n.device_id),
      deviceName(n.read_by),
      n.customer_id ?? '',
      new Date(n.created_at).toLocaleDateString('ar'),
      new Date(n.created_at).toLocaleDateString('en-CA'), // yyyy-mm-dd searchable
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

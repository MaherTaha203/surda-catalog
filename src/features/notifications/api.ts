/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible).
 *
 * Typed client over the /notifications API. Reuses the app's existing
 * apiRequest helper (base-URL + error handling) — the only shared import.
 */
import { apiRequest } from '@/api/client';
import type { Notification, NotificationType } from './types';

const JSON_HEADERS = { 'content-type': 'application/json' };

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message?: string;
  device_id?: string;
  customer_id?: string | null;
  product_id?: string | null;
}

/** Manager view — every notification, newest first. */
export async function listAllNotifications(): Promise<Notification[]> {
  return (await apiRequest<Notification[]>('/notifications-api')) ?? [];
}

/** Delegate view — notifications for this device plus broadcasts. */
export async function listDeviceNotifications(deviceId: string): Promise<Notification[]> {
  const q = `?device_id=${encodeURIComponent(deviceId)}`;
  return (await apiRequest<Notification[]>(`/notifications-api${q}`)) ?? [];
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  return apiRequest<Notification>('/notifications-api', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
}

export async function markNotificationRead(id: string): Promise<Notification> {
  return apiRequest<Notification>(`/notifications-api/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
  });
}

export async function markNotificationDone(id: string): Promise<Notification> {
  return apiRequest<Notification>(`/notifications-api/${encodeURIComponent(id)}/done`, {
    method: 'PATCH',
  });
}

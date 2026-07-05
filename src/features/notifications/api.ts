/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Typed client over the /notifications-api endpoints. Reuses the app's existing
 * apiRequest + apiUrl helpers (base-URL + error handling).
 */
import { apiRequest, apiUrl, ApiError } from '@/api/client';
import type { Notification, NotificationType, Device, AttachmentType } from './types';

const JSON_HEADERS = { 'content-type': 'application/json' };
const BASE = '/notifications-api';

export interface NotificationInput {
  type: NotificationType;
  title: string;
  message?: string;
  device_id?: string;
  device_name?: string;
  customer_id?: string | null;
  product_id?: string | null;
  attachment_path?: string | null;
  attachment_type?: AttachmentType | null;
}

// ── Notifications ─────────────────────────────────────────────────────────────

export async function listAllNotifications(): Promise<Notification[]> {
  return (await apiRequest<Notification[]>(BASE)) ?? [];
}

export async function getNotification(id: string): Promise<Notification | null> {
  try {
    return await apiRequest<Notification>(`${BASE}/${encodeURIComponent(id)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function listDeviceNotifications(deviceId: string): Promise<Notification[]> {
  return (await apiRequest<Notification[]>(`${BASE}?device_id=${encodeURIComponent(deviceId)}`)) ?? [];
}

export async function createNotification(input: NotificationInput): Promise<Notification> {
  return apiRequest<Notification>(BASE, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
}

export async function editNotification(id: string, input: NotificationInput): Promise<Notification> {
  return apiRequest<Notification>(`${BASE}/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(input),
  });
}

export async function deleteNotification(id: string): Promise<void> {
  await apiRequest<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function cancelNotification(id: string): Promise<Notification> {
  return apiRequest<Notification>(`${BASE}/${encodeURIComponent(id)}/cancel`, { method: 'PATCH' });
}

export async function markNotificationRead(id: string, deviceId: string): Promise<Notification> {
  return apiRequest<Notification>(`${BASE}/${encodeURIComponent(id)}/read`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ device_id: deviceId }),
  });
}

export async function markNotificationCompleted(id: string, deviceId: string): Promise<Notification> {
  return apiRequest<Notification>(`${BASE}/${encodeURIComponent(id)}/complete`, {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify({ device_id: deviceId }),
  });
}

// ── Device registry ───────────────────────────────────────────────────────────

export async function listDevices(): Promise<Device[]> {
  return (await apiRequest<Device[]>(`${BASE}/devices`)) ?? [];
}

export async function registerDevice(deviceId: string, deviceName: string): Promise<Device> {
  return apiRequest<Device>(`${BASE}/devices`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ device_id: deviceId, device_name: deviceName }),
  });
}

// ── Attachment upload (statement) ─────────────────────────────────────────────

export interface UploadedAttachment {
  path: string;
  type: AttachmentType;
  bytes: number;
}

/** Allowed attachment MIME/extension check mirrors the server (spec §18). */
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024;
export const ATTACHMENT_ACCEPT = '.pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg';

export async function uploadAttachment(file: File): Promise<UploadedAttachment> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(apiUrl(`${BASE}/attachment`), { method: 'POST', body: form });
  if (!res.ok) {
    let message = `فشل رفع المرفق (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as UploadedAttachment;
}

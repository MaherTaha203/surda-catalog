/**
 * EXPERIMENTAL FEATURE — Notification Center (reversible). V2.
 *
 * Attachment storage for Statement notifications. One file per notification:
 * PDF / PNG / JPG / JPEG, up to 20 MB. Files land under the existing uploads
 * base (served statically at /uploads) in an `attachments/` subfolder, so no
 * new static route is needed. Validation is by magic bytes — the extension /
 * mime is never trusted.
 */
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { UPLOADS_BASE } from '../services/storage.ts';

export const ATTACHMENTS_DIR = join(UPLOADS_BASE, 'attachments');
export const ATTACHMENTS_PREFIX = '/uploads/attachments';
export const ATTACHMENT_MAX_BYTES = 20 * 1024 * 1024; // 20 MB (spec §18)

export type AttachmentKind = 'pdf' | 'image';

export class AttachmentValidationError extends Error {}

export interface SavedAttachment {
  /** Stored, relative URL (e.g. /uploads/attachments/<uuid>.pdf). */
  path: string;
  /** 'pdf' opens in the PDF viewer; 'image' in the image viewer. */
  type: AttachmentKind;
  bytes: number;
}

/**
 * Sniff the leading bytes to confirm a real PDF / JPEG / PNG. Returns the stored
 * extension + kind, or null when the content is anything else (spec §18: reject).
 */
function sniff(buf: Buffer): { ext: string; kind: AttachmentKind } | null {
  if (buf.length < 12) return null;
  // PDF: "%PDF"
  if (buf.toString('ascii', 0, 4) === '%PDF') return { ext: 'pdf', kind: 'pdf' };
  // JPEG: FF D8 FF
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', kind: 'image' };
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return { ext: 'png', kind: 'image' };
  return null;
}

export class AttachmentStorage {
  constructor() {
    mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }

  async save(buffer: Buffer): Promise<SavedAttachment> {
    if (!buffer || buffer.length === 0) {
      throw new AttachmentValidationError('ملف فارغ');
    }
    if (buffer.length > ATTACHMENT_MAX_BYTES) {
      throw new AttachmentValidationError('الحجم الأقصى للمرفق 20 ميغابايت');
    }
    const kind = sniff(buffer);
    if (!kind) {
      throw new AttachmentValidationError('صيغة غير مسموحة — يُقبل PDF أو صورة (PNG/JPG/JPEG) فقط');
    }
    const name = `${randomUUID()}.${kind.ext}`;
    await writeFile(join(ATTACHMENTS_DIR, name), buffer);
    return { path: `${ATTACHMENTS_PREFIX}/${name}`, type: kind.kind, bytes: buffer.length };
  }

  /** Best-effort delete of a stored attachment by its relative URL. */
  async deleteByPath(path: string | null | undefined): Promise<void> {
    if (!path || typeof path !== 'string') return;
    if (!path.startsWith(ATTACHMENTS_PREFIX)) return;
    const name = basename(path);
    if (!name) return;
    const fsPath = join(ATTACHMENTS_DIR, name);
    if (existsSync(fsPath)) {
      try { await unlink(fsPath); } catch { /* best-effort */ }
    }
  }
}

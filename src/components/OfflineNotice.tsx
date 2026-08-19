import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { getLastSyncedAt } from '@/lib/offline-db';

/** Friendly Arabic "last updated" phrase for the offline strip. */
function formatLastSynced(ts: number | null): string {
  if (!ts) return '';
  const minutes = Math.floor((Date.now() - ts) / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  try {
    return new Date(ts).toLocaleDateString('ar', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

/**
 * A small, quiet strip shown ONLY while the device is offline. The catalog keeps
 * working from its local snapshot; this just reassures the rep and states when
 * the data was last refreshed. Renders nothing when online.
 */
export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  const last = formatLastSynced(getLastSyncedAt());
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 border-b border-border bg-muted/70 px-4 py-1.5 text-xs text-muted-foreground"
    >
      <WifiOff size={13} aria-hidden className="shrink-0" />
      <span>يعمل بدون اتصال{last ? ` — آخر تحديث ${last}` : ''}</span>
    </div>
  );
}

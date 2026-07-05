/**
 * Route bridge for the bulk image-import admin page. Logic lives in
 * src/features/bulk-import/.
 */
import { createFileRoute } from '@tanstack/react-router';
import { ImageImportPage } from '@/features/bulk-import';

export const Route = createFileRoute('/import-images')({
  head: () => ({ meta: [{ title: 'استيراد الصور — سردا' }] }),
  component: ImageImportPage,
});

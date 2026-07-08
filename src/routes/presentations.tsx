/**
 * Route bridge for the Presentation Builder. All logic lives in
 * src/features/presentations/. The heavy generation libraries (html2canvas +
 * jsPDF) are imported lazily inside the feature, so this route never affects
 * catalog performance.
 */
import { createFileRoute } from '@tanstack/react-router';
import { PresentationBuilderPage } from '@/features/presentations';

export const Route = createFileRoute('/presentations')({
  head: () => ({ meta: [{ title: 'العروض التسويقية — سردا' }] }),
  component: PresentationBuilderPage,
});

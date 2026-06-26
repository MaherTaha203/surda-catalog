import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'sarda-catalog-pwa-k9uwa31b',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_LAo3tJRyVH6jJyR3B7UJzL6as8bKYAyz',
  authRequired: false,
  auth: { mode: 'managed' },
})

import '@tanstack/history';

declare module '@tanstack/history' {
  interface HistoryState {
    /**
     * The exact ordered product ids the user was looking at in the catalog
     * (after category filter + search, in admin sortOrder). The product detail
     * page navigates prev/next strictly inside this list, so swiping continues
     * within the same filtered result the user came from.
     */
    catalogIds?: string[];
  }
}

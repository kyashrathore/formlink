// apps/formcraft/app/types/tanstack-table.d.ts
import "@tanstack/react-table"

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    totalFilteredCount?: number
    totalCompletedCount?: number
    totalInProgressCount?: number
    totalCount?: number // This will resolve the error
  }
}

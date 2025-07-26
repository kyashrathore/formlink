import type {
  ColumnFiltersState,
  PaginationState,
  RowSelectionState,
  SortingState,
  Table,
  VisibilityState,
} from "@tanstack/react-table"
import { create } from "zustand"

interface FilterFieldBase {
  value: string
  label: string
  options?: { label: string; value: string; count?: number }[]
  defaultOpen?: boolean
  commandDisabled?: boolean
}

export type FilterFieldCheckbox = FilterFieldBase & {
  type: "checkbox"
}

export type FilterFieldSlider = FilterFieldBase & {
  type: "slider"
  min: number
  max: number
  step?: number
}

export type FilterFieldInput = FilterFieldBase & {
  type: "input"
}

export type FilterFieldTimerange = FilterFieldBase & {
  type: "timerange"
}

export type FilterFieldRadio = FilterFieldBase & {
  type: "radio"
}

export type FilterFieldType =
  | FilterFieldCheckbox
  | FilterFieldSlider
  | FilterFieldInput
  | FilterFieldTimerange
  | FilterFieldRadio

export interface DataTableZustandState {
  table: Table<unknown> | null
  columnFilters: ColumnFiltersState
  sorting: SortingState
  rowSelection: RowSelectionState
  columnOrder: string[]
  columnVisibility: VisibilityState
  pagination: PaginationState
  filterFields: FilterFieldType[]
}

export interface DataTableZustandActions {
  setTableInstance: (table: Table<unknown> | null) => void
  setFilterFields: (filterFields: FilterFieldType[]) => void
  setColumnFilters: (
    updater:
      | ColumnFiltersState
      | ((prev: ColumnFiltersState) => ColumnFiltersState)
  ) => void
  setSorting: (
    updater: SortingState | ((prev: SortingState) => SortingState)
  ) => void
  setRowSelection: (
    updater:
      | RowSelectionState
      | ((prev: RowSelectionState) => RowSelectionState)
  ) => void
  setColumnOrder: (updater: string[] | ((prev: string[]) => string[])) => void
  setColumnVisibility: (
    updater: VisibilityState | ((prev: VisibilityState) => VisibilityState)
  ) => void
  setPagination: (
    updater: PaginationState | ((prev: PaginationState) => PaginationState)
  ) => void
  initializeState: (initialState: Partial<DataTableZustandState>) => void
  resetState: () => void
}

export type DataTableStore = DataTableZustandState & DataTableZustandActions

export const initialDataTableZustandState: DataTableZustandState = {
  table: null,
  columnFilters: [],
  sorting: [],
  rowSelection: {},
  columnOrder: [],
  columnVisibility: {},
  pagination: { pageIndex: 0, pageSize: 10 },
  filterFields: [],
}

export const useDataTableStore = create<DataTableStore>((set) => ({
  ...initialDataTableZustandState,
  setTableInstance: (table: Table<unknown> | null) => set({ table }),
  setFilterFields: (filterFields) => set({ filterFields }),
  setColumnFilters: (updater) =>
    set((state) => ({
      columnFilters:
        typeof updater === "function" ? updater(state.columnFilters) : updater,
    })),
  setSorting: (updater) =>
    set((state) => ({
      sorting: typeof updater === "function" ? updater(state.sorting) : updater,
    })),
  setRowSelection: (updater) =>
    set((state) => ({
      rowSelection:
        typeof updater === "function" ? updater(state.rowSelection) : updater,
    })),
  setColumnOrder: (updater) =>
    set((state) => ({
      columnOrder:
        typeof updater === "function" ? updater(state.columnOrder) : updater,
    })),
  setColumnVisibility: (updater) =>
    set((state) => ({
      columnVisibility:
        typeof updater === "function"
          ? updater(state.columnVisibility)
          : updater,
    })),
  setPagination: (updater) =>
    set((state) => ({
      pagination:
        typeof updater === "function" ? updater(state.pagination) : updater,
    })),
  initializeState: (initialState) =>
    set((state) => ({
      ...state,
      ...initialState,
    })),
  resetState: () => set({ ...initialDataTableZustandState, filterFields: [] }),
}))

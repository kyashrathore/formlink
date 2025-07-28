/**
 * Core types for async data handling in the new form generation architecture
 */

export type AsyncStatus = "idle" | "loading" | "success" | "error"

export interface AsyncData<T> {
  status: AsyncStatus
  data: T | null
  error: Error | null
  lastUpdated: Date | null
  retryCount?: number
  canRetry?: boolean
}

export interface AsyncCollection<T> {
  status: AsyncStatus
  items: T[]
  total: number | null
  error: Error | null
  generatedCount?: number
  progressStatus?: AsyncStatus
}

/**
 * Helper to create initial async data state
 */
export function createAsyncData<T>(initialData: T | null = null): AsyncData<T> {
  return {
    status: "idle",
    data: initialData,
    error: null,
    lastUpdated: null,
    retryCount: 0,
    canRetry: true,
  }
}

/**
 * Helper to create initial async collection state
 */
export function createAsyncCollection<T>(): AsyncCollection<T> {
  return {
    status: "idle",
    items: [],
    total: null,
    error: null,
    generatedCount: 0,
    progressStatus: "idle",
  }
}

/**
 * Type guards for async data
 */
export const isLoading = <T>(
  data: AsyncData<T> | AsyncCollection<T>
): boolean => data.status === "loading"

export const isSuccess = <T>(
  data: AsyncData<T> | AsyncCollection<T>
): boolean => data.status === "success"

export const isError = <T>(data: AsyncData<T> | AsyncCollection<T>): boolean =>
  data.status === "error"

export const hasData = <T>(
  data: AsyncData<T>
): data is AsyncData<T> & { data: T } =>
  data.status === "success" && data.data !== null

export const hasItems = <T>(collection: AsyncCollection<T>): boolean =>
  collection.items.length > 0

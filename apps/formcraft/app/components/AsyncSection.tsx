/**
 * AsyncSection Component - Base component for handling async data with loading states
 */

"use client"

import {
  AsyncCollection,
  AsyncData,
  isError,
  isLoading,
  isSuccess,
} from "@/app/lib/types/async-data"
import { Button } from "@formlink/ui"
import { AlertCircle, RefreshCw } from "lucide-react"
import React, { useMemo } from "react"
import { ErrorBoundary } from "./ErrorBoundary"

interface AsyncSectionProps<T> {
  data: AsyncData<T> | AsyncCollection<T>
  shimmer: React.ComponentType<any>
  content: React.ComponentType<{ data: T }>
  errorFallback?: React.ComponentType<{
    error: Error
    onRetry?: () => void
    canRetry?: boolean
  }>
  onRetry?: () => void
  ariaLabel?: string
  className?: string
}

// Default error component
const DefaultErrorFallback: React.FC<{
  error: Error
  onRetry?: () => void
  canRetry?: boolean
  section?: string
}> = ({ error, onRetry, canRetry = true, section }) => (
  <div className="flex min-h-[200px] flex-col items-center justify-center p-8 text-center">
    <AlertCircle className="text-destructive mb-4 h-12 w-12" />
    <h3 className="mb-2 text-lg font-semibold">
      {section ? `Error loading ${section}` : "Something went wrong"}
    </h3>
    <p className="text-muted-foreground mb-4 max-w-md text-sm">
      {error.message ||
        "An unexpected error occurred while loading this section."}
    </p>
    {canRetry && onRetry && (
      <Button onClick={onRetry} variant="outline" size="sm" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Try Again
      </Button>
    )}
  </div>
)

export function AsyncSection<T>({
  data,
  shimmer: Shimmer,
  content: Content,
  errorFallback: ErrorFallback = DefaultErrorFallback,
  onRetry,
  ariaLabel,
  className,
}: AsyncSectionProps<T>) {
  // Generate status message for screen readers
  const statusMessage = useMemo(() => {
    if (!ariaLabel) return ""

    switch (data.status) {
      case "loading":
        return `Loading ${ariaLabel}...`
      case "success":
        return `${ariaLabel} loaded successfully`
      case "error":
        return `Error loading ${ariaLabel}`
      default:
        return ""
    }
  }, [data.status, ariaLabel])

  // Extract data based on type
  const contentData = useMemo(() => {
    if ("data" in data && data.data) {
      return data.data
    }
    if ("items" in data) {
      return data as any // Pass the whole collection
    }
    return null
  }, [data])

  // Render based on status
  const renderContent = () => {
    switch (data.status) {
      case "idle":
        // If data is available, render it even if status is 'idle' (for initial loads)
        if (contentData && ("items" in data ? data.items.length > 0 : true)) {
          return (
            <ErrorBoundary section={ariaLabel}>
              <Content data={contentData} />
            </ErrorBoundary>
          )
        }
        // Otherwise, if no data and idle, return null (nothing to show yet)
        return null

      case "loading":
        // If there's already some data, show the content progressively
        if (contentData && ("items" in data ? data.items.length > 0 : true)) {
          return (
            <ErrorBoundary section={ariaLabel}>
              <Content data={contentData} />
            </ErrorBoundary>
          )
        }
        return <Shimmer />

      case "success":
        if (!contentData) return null
        return (
          <ErrorBoundary section={ariaLabel}>
            <Content data={contentData} />
          </ErrorBoundary>
        )

      case "error":
        const error = data.error || new Error("Unknown error")
        const canRetry = "canRetry" in data ? data.canRetry : true

        return (
          <ErrorFallback
            error={error}
            onRetry={onRetry}
            canRetry={canRetry && !!onRetry}
          />
        )

      default:
        return null
    }
  }

  return (
    <div className={className}>
      {/* ARIA live region for status announcements */}
      {ariaLabel && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="sr-only"
        >
          {statusMessage}
        </div>
      )}

      {renderContent()}
    </div>
  )
}

// Specialized async section for collections with progress
interface AsyncCollectionSectionProps<T>
  extends AsyncSectionProps<AsyncCollection<T>> {
  renderProgress?: (current: number, total: number | null) => React.ReactNode
}

export function AsyncCollectionSection<T>({
  data,
  renderProgress,
  ...props
}: AsyncCollectionSectionProps<T>) {
  const showProgress =
    data.status === "loading" &&
    "progressStatus" in data &&
    data.progressStatus === "success" &&
    "total" in data &&
    data.total !== null

  return (
    <>
      {showProgress && renderProgress && (
        <div
          role="progressbar"
          aria-valuenow={data.generatedCount || 0}
          aria-valuemin={0}
          aria-valuemax={data.total || 0}
          aria-label={`${props.ariaLabel} progress`}
        >
          {renderProgress(data.generatedCount || 0, data.total)}
        </div>
      )}

      <AsyncSection data={data} {...props} />
    </>
  )
}

// Hook for managing async section state
export function useAsyncSection<T>(
  data: AsyncData<T> | AsyncCollection<T>,
  options?: {
    onRetry?: () => void
    onSuccess?: (data: T) => void
    onError?: (error: Error) => void
  }
) {
  React.useEffect(() => {
    if (isSuccess(data) && options?.onSuccess && "data" in data && data.data) {
      options.onSuccess(data.data)
    }
  }, [data.status])

  React.useEffect(() => {
    if (isError(data) && options?.onError && data.error) {
      options.onError(data.error)
    }
  }, [data.status])

  return {
    isLoading: isLoading(data),
    isSuccess: isSuccess(data),
    isError: isError(data),
    retry: options?.onRetry,
  }
}

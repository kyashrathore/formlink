"use client"

import { Card, Skeleton } from "@formlink/ui"

export const MetadataShimmer = () => (
  <div
    id="form-details-step"
    data-spy-section="form-details-step"
    className="flex w-full scroll-mt-8 flex-col"
  >
    <div className="mb-4 text-lg font-semibold">Form Details</div>
    <Card className="p-4">
      <div className="animate-pulse">
        <Skeleton className="mb-3 h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </Card>
  </div>
)

export const JourneyShimmer = () => (
  <div
    id="form-journey-step"
    data-spy-section="form-journey-step"
    className="mt-8 flex w-full scroll-mt-8 flex-col"
  >
    <div className="mb-4 text-lg font-semibold">Form Journey</div>
    <Card className="p-4">
      <div className="animate-pulse space-y-4">
        <div>
          <Skeleton className="mb-2 h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    </Card>
  </div>
)

export const QuestionsShimmer = ({ count = 3 }: { count?: number }) => (
  <div
    id="questions-step"
    data-spy-section="questions-step"
    className="mb-8 flex w-full flex-col"
  >
    <div className="mt-8 mb-4 flex items-center justify-between">
      <div className="text-lg font-semibold">Questions</div>
      <div className="flex items-center space-x-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4">
          <div className="animate-pulse">
            <Skeleton className="mb-3 h-6 w-3/4" />
            <Skeleton className="mb-2 h-4 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </Card>
      ))}
    </div>
  </div>
)

export const QuestionSkeleton = () => (
  <Card className="bg-muted/30 rounded-lg border p-4">
    <div className="animate-pulse">
      <Skeleton className="mb-3 h-8 w-3/4" />
      <Skeleton className="h-6 w-1/2" />
    </div>
  </Card>
)

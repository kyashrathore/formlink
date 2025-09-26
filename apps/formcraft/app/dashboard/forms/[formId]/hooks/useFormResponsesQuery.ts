import { useEffect, useState } from "react"

export interface FormResponse {
  submission_id: string
  form_version_id: string
  user_id: string
  created_at: string
  completed_at: string | null
  status: string
  testmode: boolean
  answers: Record<string, unknown>
}

interface FormResponsesApiResponse {
  data: FormResponse[]
  page: number
  pageSize: number
  totalCount: number
  totalCompletedCount: number
  totalInProgressCount: number
  totalFilteredCount: number
  completedCount: number
  inProgressCount: number
  insights?: Array<Record<string, unknown>>
}

interface FilterItem {
  id: string
  value: unknown
}

interface UseFormResponsesQueryResult {
  data: FormResponse[]
  isLoading: boolean
  error: Error | undefined
  page: number
  pageSize: number
  totalCount: number
  totalCompletedCount: number
  totalInProgressCount: number
  totalFilteredCount: number
  completedCount: number
  inProgressCount: number
  insights?: Array<Record<string, unknown>>
}

function normalizeFilterValue(value: unknown): unknown {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const v = value as Record<string, unknown>
    if (Array.isArray(v.includes)) return v.includes
    if (Array.isArray(v.in)) return v.in
    if ("eq" in v) return (v as any).eq
  }
  return value
}

function buildSearchParam(formVersionId: string, filters: FilterItem[]) {
  const search: Record<string, unknown> = {}
  if (formVersionId) search.form_version_id = formVersionId
  const provided = new Set<string>()
  filters.forEach(({ id, value }) => {
    if (value !== undefined && value !== null) {
      search[id] = normalizeFilterValue(value)
      provided.add(id)
    }
  })
  // Default filters: hide test submissions and show completed by default if not provided
  if (!provided.has("testmode")) {
    search.testmode = false
  }
  if (!provided.has("status")) {
    search.status = "completed"
  }
  return JSON.stringify(search)
}

export function useFormResponsesQuery(
  formVersionId: string,
  filters: FilterItem[] = [],
  page: number = 1,
  pageSize: number = 50,
  insightsSpec?: Array<Record<string, unknown>>
): UseFormResponsesQueryResult {
  const [data, setData] = useState<FormResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | undefined>(undefined)
  const [currentPage, setCurrentPage] = useState(page)
  const [currentPageSize, setCurrentPageSize] = useState(pageSize)
  const [totalCount, setTotalCount] = useState(0)
  const [totalCompletedCount, setTotalCompletedCount] = useState(0)
  const [totalInProgressCount, setTotalInProgressCount] = useState(0)
  const [totalFilteredCount, setTotalFilteredCount] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [inProgressCount, setInProgressCount] = useState(0)
  const [insightsState, setInsightsState] = useState<
    Array<Record<string, unknown>> | undefined
  >(undefined)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(undefined)

    const search = buildSearchParam(formVersionId, filters)
    const params = new URLSearchParams({
      search,
      page: String(page),
      pageSize: String(pageSize),
    })
    if (insightsSpec && insightsSpec.length) {
      try {
        params.set("insights", JSON.stringify(insightsSpec))
      } catch {}
    }
    const url = `/api/responses?${params.toString()}`

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch responses")
        const json = (await res.json()) as FormResponsesApiResponse
        if (cancelled) return
        setData(json.data || [])
        setCurrentPage(json.page || page)
        setCurrentPageSize(json.pageSize || pageSize)
        setTotalCount(json.totalCount || 0)
        setTotalCompletedCount(json.totalCompletedCount || 0)
        setTotalInProgressCount(json.totalInProgressCount || 0)
        setTotalFilteredCount(json.totalFilteredCount || 0)
        setCompletedCount(json.completedCount || 0)
        setInProgressCount(json.inProgressCount || 0)
        setInsightsState(json.insights || undefined)
        setIsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err)
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [
    formVersionId,
    JSON.stringify(filters),
    page,
    pageSize,
    JSON.stringify(insightsSpec || []),
  ])

  return {
    data,
    isLoading,
    error,
    page: currentPage,
    pageSize: currentPageSize,
    totalCount,
    totalCompletedCount,
    totalInProgressCount,
    totalFilteredCount,
    completedCount,
    inProgressCount,
    insights: insightsState,
  }
}

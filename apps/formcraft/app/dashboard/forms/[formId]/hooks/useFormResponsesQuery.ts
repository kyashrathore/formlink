import { useEffect, useState } from "react"

export interface FormResponse {
  submission_id: string
  form_version_id: string
  user_id: string
  created_at: string
  completed_at: string | null
  status: string
  testmode: boolean
  answers: Record<string, any>
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
}

function buildSearchParam(
  formVersionId: string,
  filters: { id: string; value: any }[]
) {
  const search: Record<string, any> = {}
  if (formVersionId) search.form_version_id = formVersionId
  filters.forEach(({ id, value }) => {
    if (value !== undefined && value !== null) {
      search[id] = value
    }
  })
  return JSON.stringify(search)
}

export function useFormResponsesQuery(
  formVersionId: string,
  filters: { id: string; value: any }[] = [],
  page: number = 1,
  pageSize: number = 50
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

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(undefined)

    const search = buildSearchParam(formVersionId, filters)
    const url = `/api/responses?search=${encodeURIComponent(search)}&page=${page}&pageSize=${pageSize}`

    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to fetch responses")
        const json = (await res.json()) as any // API response includes all counts
        if (cancelled) return
        setData(json.data || []) // json.data is FormResponse[]
        setCurrentPage(json.page || page)
        setCurrentPageSize(json.pageSize || pageSize)
        setTotalCount(json.totalCount || 0)
        setTotalCompletedCount(json.totalCompletedCount || 0)
        setTotalInProgressCount(json.totalInProgressCount || 0)
        setTotalFilteredCount(json.totalFilteredCount || 0)
        setCompletedCount(json.completedCount || 0)
        setInProgressCount(json.inProgressCount || 0)
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
  }, [formVersionId, JSON.stringify(filters), page, pageSize])

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
  }
}

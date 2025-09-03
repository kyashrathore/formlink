"use client"

import { useQuery } from "@tanstack/react-query"

async function fetchForm(formId: string) {
  const res = await fetch(`/api/forms/${formId}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const error: any = new Error(data.error || res.statusText)
    // annotate status for retry policy
    error.status = res.status
    throw error
  }
  return res.json()
}

export function useFormDataQuery(formId: string | undefined) {
  return useQuery({
    queryKey: ["form", formId],
    queryFn: () => fetchForm(formId as string),
    enabled: Boolean(formId),
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false
      return failureCount < 1
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

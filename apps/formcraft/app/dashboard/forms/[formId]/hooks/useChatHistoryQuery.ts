"use client"

import { useQuery } from "@tanstack/react-query"

async function fetchChatHistory(formId: string) {
  const res = await fetch(`/api/chat?formId=${formId}`)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    const error: any = new Error(data.error || res.statusText)
    error.status = res.status
    throw error
  }
  return res.json() as Promise<any[]>
}

export function useChatHistoryQuery(
  formId: string | undefined,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["chat-history", formId],
    queryFn: () => fetchChatHistory(formId as string),
    enabled: Boolean(formId) && enabled,
    retry: (failureCount, error: any) => {
      if (error?.status === 404) return false
      return failureCount < 1
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })
}

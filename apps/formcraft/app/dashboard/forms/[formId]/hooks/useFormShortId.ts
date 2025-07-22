import { useEffect, useState } from "react"

export function useFormShortId(formId: string) {
  const [shortId, setShortId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchShortId() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`/api/forms/${formId}/short-id`)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage =
            errorData.error ||
            `Failed to fetch form shortId (${response.status})`
          throw new Error(errorMessage)
        }

        const data = await response.json()
        setShortId(data.shortId)
      } catch (err) {
        console.error("Error fetching shortId:", err)
        setError(err instanceof Error ? err.message : "Unknown error")
        setShortId(null)
      } finally {
        setLoading(false)
      }
    }

    if (formId) {
      fetchShortId()
    }
  }, [formId])

  return { shortId, loading, error }
}

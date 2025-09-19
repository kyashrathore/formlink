"use client"

import { useState } from "react"
import { Button } from "@formlink/ui"
import { Trash2 } from "lucide-react"

export default function CleanupTestDataButton({
  formId,
  onDone,
}: {
  formId: string
  onDone?: () => void
}) {
  const enabled = process.env.NEXT_PUBLIC_ENABLE_TESTDATA === "true"
  const [loading, setLoading] = useState(false)
  if (!enabled) return null

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={loading}
      onClick={async () => {
        if (!confirm("Are you sure you want to delete all test data for this form?")) {
          return
        }
        try {
          setLoading(true)
          const res = await fetch(`/api/responses/cleanup`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ form_id: formId }),
          })
          if (!res.ok) throw new Error("Failed to cleanup test data")
          const data = await res.json()
          alert(`Deleted ${data.submissions_deleted} test submissions and ${data.answers_deleted} answers`)
          onDone?.()
        } catch (e) {
          console.error(e)
          alert("Failed to cleanup test data. Check console for details.")
        } finally {
          setLoading(false)
        }
      }}
    >
      <Trash2 className="mr-2" size={14} />
      {loading ? "Cleaning..." : "Clean Test Data"}
    </Button>
  )
}
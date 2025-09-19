"use client"

import { useState } from "react"
import { Button } from "@formlink/ui"
import { Loader } from "@formlink/ui/ui/loader"

export default function GenerateTestDataButton({
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
        try {
          setLoading(true)
          const res = await fetch(`/api/responses/generate`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ form_id: formId, count: 100 }),
          })
          if (!res.ok) throw new Error("Failed to generate test data")
          onDone?.()
        } catch (e) {
          console.error(e)
          alert("Failed to generate test data. Check console for details.")
        } finally {
          setLoading(false)
        }
      }}
    >
      {loading ? (
        <>
          <Loader className="mr-2" size={14} /> Generating…
        </>
      ) : (
        "Generate 100 Test Responses"
      )}
    </Button>
  )
}

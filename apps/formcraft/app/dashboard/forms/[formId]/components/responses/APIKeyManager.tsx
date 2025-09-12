"use client"

import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@formlink/ui"
import React, { useState } from "react"

export const APIKeyManager: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("Embed Key")
  const [createdKey, setCreatedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function createKey() {
    setLoading(true)
    try {
      const res = await fetch(`/api/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, permissions: ["read_responses"] }),
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(txt || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setCreatedKey(json.key)
    } catch (e) {
      console.error(e)
      const msg = (e as any)?.message || String(e)
      if (msg.includes("api_keys_table_missing")) {
        alert(
          "API keys table missing. Apply DB migrations (packages/db/src/migrations) and restart Supabase."
        )
      } else if (msg.includes("api_keys_rls_denied")) {
        alert(
          "RLS denied. Apply RLS policies migration and ensure you are authenticated."
        )
      } else {
        alert("Failed to create API key")
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          API Key
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          <Button size="sm" onClick={createKey} disabled={loading}>
            Create
          </Button>
        </div>
        {createdKey ? (
          <div className="mt-3">
            <p className="text-muted-foreground text-sm">
              Copy and store this key now. It will not be shown again.
            </p>
            <pre className="bg-muted rounded-md p-3 text-xs">{createdKey}</pre>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

export default APIKeyManager

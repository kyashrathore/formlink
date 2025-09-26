"use client"

// Local helpers extracted from SetupDialog for reuse across parts.

export const getByPath = (obj: any, path: string) => {
  return path.split(".").reduce((acc, key) => (acc ? acc[key] : undefined), obj)
}

export const setByPath = (obj: any, path: string, value: unknown) => {
  const parts = path.split(".")
  const last = parts.pop() as string
  let cursor = obj
  for (const p of parts) {
    if (!cursor[p] || typeof cursor[p] !== "object") cursor[p] = {}
    cursor = cursor[p]
  }
  cursor[last] = value
}

// Flatten object into dot paths for scalar leaves to allow showing all suggested fields
export const flattenScalarPaths = (obj: any, base = ""): string[] => {
  const out: string[] = []
  if (!obj || typeof obj !== "object") return out
  for (const [k, v] of Object.entries(obj)) {
    const path = base ? `${base}.${k}` : k
    if (
      v == null ||
      typeof v === "string" ||
      typeof v === "number" ||
      typeof v === "boolean"
    ) {
      out.push(path)
    } else if (Array.isArray(v)) {
      // Keep parent editable for arrays; nested item mapping not supported here
      out.push(path)
    } else if (typeof v === "object") {
      const nested = flattenScalarPaths(v, path)
      if (nested.length) out.push(...nested)
      else out.push(path)
    }
  }
  return out
}

export const tokenForQuestion = (qid: string) => `{{answer:${qid}}}`

export const parseToken = (value: unknown): string | null => {
  if (typeof value !== "string") return null
  const m = value.match(/^\{\{\s*answer:([^}]+)\s*\}\}$/)
  return m ? (m[1] ?? null) : null
}

// --- Suggestion helpers (Sheets + normalization) ---
const excelColToIndex = (letters: string): number => {
  let n = 0
  const up = letters.toUpperCase()
  for (let i = 0; i < up.length; i++) {
    const code = up.charCodeAt(i)
    if (code < 65 || code > 90) return 0 // not A-Z
    const c = code - 64 // 'A' -> 1
    n = n * 26 + c
  }
  return n
}

export const countColsFromRange = (range?: string): number | null => {
  if (!range) return null
  // Accept forms like Sheet1!A2:H or A2:H10 or A:H
  const m = range.match(/([A-Z]+)\d*\s*:\s*([A-Z]+)/i)
  if (!m) return null
  const start = excelColToIndex(m[1]!)
  const end = excelColToIndex(m[2]!)
  if (!start || !end) return null
  return Math.max(1, end - start + 1)
}

export const finalizeSuggestion = (
  slug: string,
  base: Record<string, unknown>,
  questions: Array<{ id: string; label: string }>
): Record<string, unknown> => {
  let next = { ...(base || {}) }
  if (slug === "HUBSPOT_CREATE_CONTACT_OBJECT_WITH_PROPERTIES") {
    const hasProps =
      next && typeof next === "object" && (next as any).properties
    if (!hasProps) {
      const props: Record<string, unknown> = {}
      for (const k of ["email", "firstname", "lastname", "phone", "company"]) {
        if ((next as any)[k] != null) props[k] = (next as any)[k]
      }
      next = { ...next, properties: props }
    }
  }
  if (slug === "GOOGLESHEETS_BATCH_UPDATE") {
    const already = (next as any).values
    if (!already) {
      const rng = String((next as any)?.range || "")
      const colCount =
        countColsFromRange(rng) || Math.max(1, questions.length || 0)
      const row: string[] = []
      for (let i = 0; i < colCount; i++) {
        const q = questions[i]
        row.push(q ? tokenForQuestion(q.id) : "")
      }
      ;(next as any).values = [row]
    }
  }
  return next
}

export type Question = { id: string; label: string }

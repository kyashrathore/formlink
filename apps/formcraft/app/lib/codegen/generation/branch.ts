import { nanoid } from "nanoid"

function sanitizeSegment(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-/]+|[-/]+$/g, "")
}

export function buildFormBranchName(
  formId: string,
  override?: string | null
): string {
  const candidate = override
    ? sanitizeSegment(override)
    : sanitizeSegment(`form-${formId}`)
  return candidate || `form-${nanoid(6)}`
}

export function buildFallbackBranchName(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5)
  return `form-${timestamp}-${nanoid(4)}`
}

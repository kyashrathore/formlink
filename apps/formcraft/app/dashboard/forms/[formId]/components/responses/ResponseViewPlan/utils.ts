import { CURATED_ACTIONS } from "@/app/lib/actions/registry"

export function humanizeToolkit(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function requiresParamsForSlug(slug: string): boolean {
  const a = CURATED_ACTIONS.find((x) => x.slug === slug)
  const rp = (a as any)?.requiredParams
  return Boolean(rp && typeof rp === "object" && Object.keys(rp).length > 0)
}

export function formatActionStatus(
  status: string,
  provider: string,
  remoteEnabled: boolean
) {
  if (provider === "usesend") {
    if (status === "connected" || status === "ready") return "Ready"
    return "Check configuration"
  }
  if (!remoteEnabled) return "Integration disabled"
  if (!status || status === "unknown") return "Needs auth"
  const lowered = status.toLowerCase()
  if (lowered.includes("pending")) return "Pending auth"
  if (
    lowered === "connected" ||
    lowered === "ready" ||
    lowered === "authorized" ||
    lowered === "success" ||
    lowered === "active" ||
    lowered === "ok"
  )
    return "Ready"
  if (
    lowered === "not_configured" ||
    lowered === "unauthorized" ||
    lowered === "revoked" ||
    lowered === "disconnected"
  )
    return "Needs auth"
  return status
}

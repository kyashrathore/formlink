export interface EnrichmentResult {
  enrichment: Record<string, unknown>
  summary: string
}

function extractEmail(values: Record<string, unknown>): string | null {
  for (const value of Object.values(values)) {
    if (typeof value === "string" && value.includes("@")) {
      return value.trim()
    }
  }
  return null
}

function extractWebsite(values: Record<string, unknown>): string | null {
  for (const value of Object.values(values)) {
    if (typeof value === "string" && value.startsWith("http")) {
      return value.trim()
    }
  }
  return null
}

export function runEnrichment(
  answers: Record<string, unknown>,
  existingSidecar: Record<string, unknown>
): EnrichmentResult {
  const enrichment: Record<string, unknown> = {
    ...(existingSidecar.enrichment as Record<string, unknown> | undefined),
  }

  const email = extractEmail(answers)
  if (email && typeof email === "string" && email.includes("@")) {
    const [, domainRaw] = email.split("@")
    if (domainRaw) {
      const domain = domainRaw.toLowerCase()
      enrichment.email = email
      enrichment.company = {
        ...(enrichment.company as Record<string, unknown> | undefined),
        domain,
      }
    }
  }

  const website = extractWebsite(answers)
  if (website) {
    enrichment.company = {
      ...(enrichment.company as Record<string, unknown> | undefined),
      website,
    }
  }

  const summary =
    [email ? `email=${email}` : null, website ? `website=${website}` : null]
      .filter(Boolean)
      .join(", ") || "no_enrichment"

  return { enrichment, summary }
}

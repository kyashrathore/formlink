/**
 * Parse Shadcn-style theme CSS and return canonical output.
 * - Keeps only custom properties declared under :root and .dark
 * - Preserves source order as parsed by CSSOM
 * - Produces a stable, sorted canonical CSS string for storage/SSR
 */

export interface ParsedShadcnResult {
  root: Record<string, string>
  dark: Record<string, string>
  css: string // canonical CSS (unscoped): :root{…}\n[.dark{…}]
  warnings: string[]
}

export function parseShadcnCSS(input: string): ParsedShadcnResult {
  const warnings: string[] = []

  // Fast path for empty/whitespace input
  if (!input || !input.trim()) {
    return { root: {}, dark: {}, css: "", warnings: ["Empty CSS input"] }
  }

  // Create a temporary style element to leverage CSSOM parsing in browser
  const styleEl = document.createElement("style")
  // Prevent affecting the editor UI while still allowing CSSOM to parse rules
  styleEl.media = "not all"
  styleEl.textContent = input
  document.head.appendChild(styleEl)

  const root: Record<string, string> = {}
  const dark: Record<string, string> = {}

  try {
    const sheet = styleEl.sheet as CSSStyleSheet | null
    if (!sheet) {
      warnings.push("Failed to create CSSStyleSheet; input may be invalid")
    } else {
      // Iterate rules and pick STYLE_RULEs with :root or .dark in selector list
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule.type !== CSSRule.STYLE_RULE) continue
        const r = rule as CSSStyleRule
        const selectors = r.selectorText
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)

        const targets: Array<"root" | "dark"> = []
        const darkAliases = new Set([
          ".dark",
          '[data-theme="dark"]',
          ":root.dark",
          "html.dark",
          "body.dark",
        ])
        if (selectors.includes(":root")) targets.push("root")
        if (selectors.some((s) => darkAliases.has(s))) targets.push("dark")
        if (targets.length === 0) continue

        for (let i = 0; i < r.style.length; i++) {
          const prop = r.style.item(i)
          if (!prop || !prop.startsWith("--")) continue // only custom properties
          const val = r.style.getPropertyValue(prop).trim()
          if (!val) continue
          for (const t of targets) {
            if (t === "root") root[prop] = val // later overwrite earlier
            if (t === "dark") dark[prop] = val
          }
        }
      }
    }
  } catch (e) {
    warnings.push(
      e instanceof Error ? e.message : "Unknown error parsing CSS via CSSOM"
    )
  } finally {
    // Cleanup the temporary style element
    styleEl.remove()
  }

  // Validate a small set of commonly expected vars
  const required = [
    "--background",
    "--foreground",
    "--primary",
    "--primary-foreground",
  ]
  const missing = required.filter((k) => !root[k])
  if (missing.length) {
    warnings.push(`Missing variables: ${missing.join(", ")}`)
  }

  // Canonical CSS: sorted keys for deterministic storage and cache keys
  const rootEntries = Object.entries(root).sort(([a], [b]) =>
    a.localeCompare(b)
  )
  const darkEntries = Object.entries(dark).sort(([a], [b]) =>
    a.localeCompare(b)
  )

  const parts: string[] = []
  if (rootEntries.length) {
    parts.push(
      ":root {\n" +
        rootEntries.map(([k, v]) => `  ${k}: ${v};`).join("\n") +
        "\n}"
    )
  }
  if (darkEntries.length) {
    parts.push(
      ".dark {\n" +
        darkEntries.map(([k, v]) => `  ${k}: ${v};`).join("\n") +
        "\n}"
    )
  }

  return { root, dark, css: parts.join("\n\n"), warnings }
}

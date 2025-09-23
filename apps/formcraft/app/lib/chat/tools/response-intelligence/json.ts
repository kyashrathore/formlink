export function extractFirstJSONObject(input: string): string | null {
  const start = input.indexOf("{")
  if (start < 0) return null

  let depth = 0
  for (let i = start; i < input.length; i++) {
    const char = input[i]
    if (char === "{") depth += 1
    else if (char === "}") depth -= 1
    if (depth === 0) return input.slice(start, i + 1)
  }

  return null
}

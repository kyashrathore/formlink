const KEYWORD_TAGS: Array<{ keyword: RegExp; tag: string }> = [
  { keyword: /pricing/i, tag: "pricing" },
  { keyword: /bug|issue|error/i, tag: "bug" },
  { keyword: /love|excited|amazing/i, tag: "superfan" },
  { keyword: /enterprise|contract/i, tag: "enterprise" },
]

export function runTagging(answers: Record<string, unknown>): {
  tags: string[]
  summary: string
} {
  const textCorpus = Object.values(answers)
    .filter((value): value is string => typeof value === "string")
    .join("\n")

  const tags = new Set<string>()
  KEYWORD_TAGS.forEach(({ keyword, tag }) => {
    if (keyword.test(textCorpus)) tags.add(tag)
  })

  return {
    tags: Array.from(tags),
    summary: tags.size ? Array.from(tags).join(",") : "no_tags",
  }
}

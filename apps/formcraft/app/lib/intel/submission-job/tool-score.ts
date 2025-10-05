type LeadScoreResult = {
  score: number
  tier: "A" | "B" | "C" | "D"
  summary: string
}

const TIER_THRESHOLDS: Array<{ tier: LeadScoreResult["tier"]; min: number }> = [
  { tier: "A", min: 80 },
  { tier: "B", min: 60 },
  { tier: "C", min: 35 },
  { tier: "D", min: 0 },
]

export function runLeadScore(
  answers: Record<string, unknown>
): LeadScoreResult {
  const totalQuestions = Object.keys(answers).length
  if (!totalQuestions) {
    return { score: 0, tier: "D", summary: "no_answers" }
  }

  let filled = 0
  let textWeight = 0

  Object.values(answers).forEach((value) => {
    if (value == null) return
    if (Array.isArray(value) && value.length) filled += 1
    else if (typeof value === "string" && value.trim()) {
      filled += 1
      textWeight += Math.min(20, value.trim().length / 8)
    } else if (typeof value === "object") {
      filled += 1
      textWeight += 5
    } else {
      filled += 1
    }
  })

  const completionScore = (filled / totalQuestions) * 60
  const richnessScore = Math.min(40, textWeight)
  const score = Math.min(100, Math.round(completionScore + richnessScore))

  const tier =
    TIER_THRESHOLDS.find((candidate) => score >= candidate.min)?.tier ?? "D"

  return {
    score,
    tier,
    summary: `filled=${filled}/${totalQuestions}, richness=${Math.round(richnessScore)}`,
  }
}

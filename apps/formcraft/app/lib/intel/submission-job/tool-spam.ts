type SpamCheckResult = {
  score: number
  flags: string[]
  summary: string
}

const URL_REGEX = /https?:\/\//gi

function isLikelyGibberish(value: string): boolean {
  const noWhitespace = value.replace(/\s+/g, "")
  if (noWhitespace.length < 12) return false
  const consonantRun = /(bcdfghjklmnpqrstvwxyz){6,}/i
  return consonantRun.test(noWhitespace)
}

export function runSpamCheck(
  answers: Record<string, unknown>
): SpamCheckResult {
  let urlCount = 0
  let longEntries = 0
  let gibberishCount = 0

  Object.values(answers).forEach((value) => {
    if (typeof value === "string") {
      const matches = value.match(URL_REGEX)
      if (matches) urlCount += matches.length

      if (value.length > 400) longEntries += 1
      if (isLikelyGibberish(value)) gibberishCount += 1
    }
  })

  const flags: string[] = []
  if (urlCount >= 3) flags.push("many_urls")
  if (longEntries >= 2) flags.push("very_long_answers")
  if (gibberishCount > 0) flags.push("gibberish_detected")

  const score = Math.min(
    1,
    urlCount * 0.1 + longEntries * 0.15 + gibberishCount * 0.25
  )

  return {
    score,
    flags,
    summary: `urlCount=${urlCount}, longEntries=${longEntries}, gibberish=${gibberishCount}`,
  }
}

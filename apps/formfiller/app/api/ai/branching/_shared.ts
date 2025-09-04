import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";

export interface BranchingParams {
  journeyScript: string;
  answerHistory: Record<string, any>;
  questions: Array<{ id: string; [key: string]: any }>;
  currentQuestionId: string;
}

export async function decideNextQuestion({
  journeyScript,
  answerHistory,
  questions,
  currentQuestionId,
}: BranchingParams): Promise<string | null> {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY || "";
    if (!apiKey) {
      console.warn("OPENROUTER_API_KEY not set; falling back to linear order");
      return nextUnansweredLinear(answerHistory, questions);
    }

    const provider = createOpenRouter({ apiKey });
    const model = provider("google/gemini-2.5-flash");

    const validQuestionIds = questions.map((q) => q.id);
    const system = `You are an AI form flow director. Analyze responses and determine the next question per the journey script's branching logic.

Rules:
- Only return IDs from the provided VALID QUESTION IDS list.
- If no branching applies, return the next question in sequence after the current one that is not yet answered.
- Respond with JSON: {"nextQuestionId":"..."}`;

    const prompt = `
JOURNEY SCRIPT\n${journeyScript}

CURRENT QUESTION ID: ${currentQuestionId}

USER ANSWER HISTORY:
${JSON.stringify(answerHistory, null, 2)}

VALID QUESTION IDS:
${validQuestionIds.join(", ")}

Return JSON {"nextQuestionId":"..."} only.`;

    const { text } = await generateText({ model, system, prompt });

    try {
      const parsed = JSON.parse(text);
      const nextId: string | undefined = parsed?.nextQuestionId;
      if (nextId && validQuestionIds.includes(nextId)) return nextId;
    } catch {}

    // Fallback extraction
    const m = text.match(/["']([^"']+)["']/);
    if (m && typeof m[1] === "string" && validQuestionIds.includes(m[1])) {
      return m[1] as string;
    }

    // Last fallback: linear
    return nextUnansweredLinear(answerHistory, questions);
  } catch (e) {
    console.error("decideNextQuestion error:", e);
    return nextUnansweredLinear(answerHistory, questions);
  }
}

function nextUnansweredLinear(
  answerHistory: Record<string, any>,
  questions: Array<{ id: string }>,
): string | null {
  const answered = new Set(Object.keys(answerHistory || {}));
  const next = questions.find((q) => !answered.has(q.id));
  return next?.id ?? null;
}

import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { loadPrompt } from "@formlink/prompts";

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
    const system = await loadPrompt("filler/branching-system.md");
    const prompt = await loadPrompt("filler/branching-user.md", {
      journey_script: journeyScript,
      current_question_id: currentQuestionId,
      answer_history: answerHistory,
      valid_ids: validQuestionIds.join(", "),
    });

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

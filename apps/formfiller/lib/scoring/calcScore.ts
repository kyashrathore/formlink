import { QuestionResponse } from "@/lib/types";
import {
  Form,
  getOptions,
  isChoiceQuestion,
  isLinearScaleQuestion,
  isRatingQuestion,
} from "@formlink/schema";

export interface ScoreBreakdownItem {
  questionId: string;
  questionTitle: string;
  earned: number;
  possible: number;
}

export interface ScoreResult {
  total: number;
  possible: number;
  percentage: number; // 0-100
  breakdown: ScoreBreakdownItem[];
}

export function calcScore(
  form: Form,
  responses: Record<string, QuestionResponse>,
): ScoreResult {
  let total = 0;
  let possible = 0;
  const breakdown: ScoreBreakdownItem[] = [];

  for (const q of form.questions) {
    const title = (q as { label?: string }).label || q.title;
    const resp = responses[q.id];
    let earned = 0;
    let maxForQ = 0;

    if (isChoiceQuestion(q) && q.type.name === "singleChoice") {
      const options = (getOptions(q) || []).map((o) => ({
        value: o.value,
        label: o.label,
        score: (o as { score?: number }).score,
      }));
      // Max score among options (fallback 0)
      maxForQ = options.reduce((m, o) => Math.max(m, o.score ?? 0), 0);
      if (typeof resp === "string") {
        const opt = options.find((o) => String(o.value) === String(resp));
        earned = opt?.score ?? 0;
      }
    } else if (isChoiceQuestion(q) && q.type.name === "multipleChoice") {
      const options = (getOptions(q) || []).map((o) => ({
        value: o.value,
        label: o.label,
        score: (o as { score?: number }).score,
      }));
      // Sum of all positive option scores defines theoretical maximum
      maxForQ = options.reduce((s, o) => s + Math.max(0, o.score ?? 0), 0);
      const selected: string[] = Array.isArray(resp) ? (resp as string[]) : [];
      earned = options
        .filter((o) => selected.some((v) => String(v) === String(o.value)))
        .reduce((s, o) => s + (o.score ?? 0), 0);
    } else if (isRatingQuestion(q) || isLinearScaleQuestion(q)) {
      // If author specified question-level score (e.g., correctness handled elsewhere), use it as max
      // Otherwise do not contribute to score by default
      const qScore = (q as { score?: number }).score;
      if (typeof qScore === "number") {
        maxForQ = qScore;
        // Earned only if answered (simple model). Advanced mapping can be added later.
        earned = resp != null && resp !== "" ? qScore : 0;
      }
    } else {
      // For other types, check if a default question-level score is defined
      const qScore = (q as { score?: number }).score;
      if (typeof qScore === "number") {
        maxForQ = qScore;
        earned = resp != null && resp !== "" ? qScore : 0;
      }
    }

    if (maxForQ > 0) {
      total += earned;
      possible += maxForQ;
      breakdown.push({
        questionId: q.id,
        questionTitle: title,
        earned,
        possible: maxForQ,
      });
    }
  }

  const percentage = possible > 0 ? (total / possible) * 100 : 0;
  return { total, possible, percentage, breakdown };
}

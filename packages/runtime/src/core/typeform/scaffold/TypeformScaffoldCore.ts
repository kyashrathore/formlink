import type { FormlinkFlow } from "../../formlinkFlow";
import type { RuntimeContextSnapshot } from "../../../types";

export type DeriveResult = {
  qId: string | null;
  index: number;
  total: number;
};

export function derive(
  snapshot: RuntimeContextSnapshot,
  engine?: FormlinkFlow,
): DeriveResult {
  const qId = snapshot.currentId ?? snapshot.firstUnansweredId ?? null;
  if (!qId) return { qId: null, index: 0, total: snapshot.progress.total };
  if (!engine)
    return {
      qId,
      index: snapshot.progress.index,
      total: snapshot.progress.total,
    };
  let branch: string[] = [];
  try {
    branch = engine.path(snapshot.values);
  } catch {
    branch = [];
  }
  const idx = branch.length > 0 ? branch.indexOf(qId) : -1;
  const index = idx >= 0 ? idx : snapshot.progress.index;
  const total = branch.length > 0 ? branch.length : snapshot.progress.total;
  return { qId, index, total };
}

export function direction(
  prevIndex: number,
  nextIndex: number,
  navHint?: 1 | -1 | null,
): 1 | -1 {
  if (navHint === 1 || navHint === -1) return navHint;
  return nextIndex >= prevIndex ? 1 : -1;
}

export function shouldAutoAdvance(
  questionType: string,
  prevValue: unknown,
  nextValue: unknown,
): boolean {
  // Quick interactions that should auto-advance when value becomes non-empty
  switch (questionType) {
    case "singleChoice":
    case "likertScale":
    case "rating":
    case "linearScale":
    case "country":
    case "dropdown":
    case "date":
      return (
        nextValue != null &&
        String(nextValue).length > 0 &&
        nextValue !== prevValue
      );
    default:
      return false;
  }
}

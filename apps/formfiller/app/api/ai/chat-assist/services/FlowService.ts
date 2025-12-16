import type { Question } from "../utils";

export class FlowService {
  static normalizeBehavior(
    value: unknown,
  ): "auto" | "manualClear" | "manualUnclear" | null {
    if (
      value === "auto" ||
      value === "manualClear" ||
      value === "manualUnclear"
    ) {
      return value;
    }
    return null;
  }

  static findFirstUnanswered(
    formSchema: any,
    responses: Record<string, unknown>,
  ): string | null {
    if (!Array.isArray(formSchema?.questions)) {
      return null;
    }
    return (
      formSchema.questions.find(
        (q: Question) =>
          !Object.prototype.hasOwnProperty.call(responses || {}, q.id),
      )?.id ?? null
    );
  }

  static determineCurrentQuestionId(
    submissionBehavior: string | null,
    requestedQuestionId: string | null | undefined,
    fallbackQuestionId: string | null,
  ): string | null {
    const questionIdFromBehavior =
      submissionBehavior === "manualUnclear"
        ? requestedQuestionId || fallbackQuestionId
        : requestedQuestionId;

    return questionIdFromBehavior || fallbackQuestionId;
  }
}

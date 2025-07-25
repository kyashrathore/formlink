import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import jsonata from "jsonata";
import { Question } from "@formlink/schema";
import { QuestionResponseMap } from "./types";

/**
 * Tailwind/classnames utility
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Evaluates a JSONata condition against responses.
 */
function evaluateCondition(
  condition: string,
  responses: QuestionResponseMap,
): boolean {
  try {
    const expression = jsonata(condition);
    const result = expression.evaluate(responses);
    // Ensure the result of the JSONata expression is explicitly boolean
    return typeof result === "boolean" ? result : false;
  } catch (error) {
    console.error("Error evaluating JSONata expression:", condition, error);
    // Default to false or handle error as appropriate for your application's logic
    return false;
  }
}

/**
 * Determines if a question should be shown based on conditional logic.
 */
function shouldShowQuestion(
  question: Question | undefined,
  responses: QuestionResponseMap,
): boolean {
  if (!question) return false;

  const conditionalLogic = question.conditionalLogic;
  if (
    !conditionalLogic ||
    !Array.isArray(conditionalLogic) ||
    conditionalLogic.length === 0
  ) {
    return true;
  }

  let isHidden = false;
  let isShown = false;
  let hasExplicitShowRule = false;

  for (const rule of conditionalLogic) {
    if (!rule) continue;

    let ruleMet = false;
    const conditions = rule.conditions || [];

    if (conditions.length === 0) continue;

    const conditionResults = conditions.map((cond: string) =>
      cond ? evaluateCondition(cond, responses) : false,
    );

    if (rule.logic === "AND") {
      ruleMet = conditionResults.every(Boolean);
    } else if (rule.logic === "OR") {
      ruleMet = conditionResults.some(Boolean);
    } else {
      ruleMet = conditionResults.some(Boolean);
    }

    if (ruleMet) {
      if (rule.action === "hide") {
        isHidden = true;
        break;
      } else if (rule.action === "show") {
        isShown = true;
        hasExplicitShowRule = true;
      }
    }

    if (rule.action === "show") {
      hasExplicitShowRule = true;
    }
  }

  if (isHidden) return false;
  if (hasExplicitShowRule) return isShown;
  return true;
}

/**
 * Finds the next question to show based on current question and responses.
 */
export function findNextQuestion(
  currentQuestion: Question,
  questions: Question[],
  responses: QuestionResponseMap,
): Question | undefined {
  if (!currentQuestion || !questions || !Array.isArray(questions)) {
    return undefined;
  }

  const currentIndex = questions.findIndex((q) => q.id === currentQuestion.id);
  if (currentIndex === -1) return undefined;

  let nextIndex = currentIndex + 1;
  while (nextIndex < questions.length) {
    const potentialNextQuestion = questions[nextIndex];
    if (
      potentialNextQuestion &&
      shouldShowQuestion(potentialNextQuestion, responses)
    ) {
      return potentialNextQuestion;
    }
    nextIndex++;
  }

  return undefined;
}

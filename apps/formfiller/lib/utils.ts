import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Question } from "@formlink/schema";
import type { QuestionResponse, FileData } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function findNextQuestion(
  currentQuestion: Question,
  allQuestions: Question[],
  responses: Record<string, QuestionResponse>,
): Question | undefined {
  const currentIndex = allQuestions.findIndex((q) => q.id === currentQuestion.id);
  if (currentIndex === -1) return undefined;

  for (let i = currentIndex + 1; i < allQuestions.length; i++) {
    const nextQuestion = allQuestions[i];
    if (nextQuestion && shouldShowQuestion(nextQuestion, responses)) {
      return nextQuestion;
    }
  }

  return undefined;
}

export function shouldShowQuestion(
  question: Question,
  responses: Record<string, QuestionResponse>,
): boolean {
  if (!question.conditionalLogic) {
    return true;
  }

  // This is a simplified implementation. A real implementation would
  // use a library like jsonata to evaluate the conditional logic.
  return true;
}

export function fileDataToFile(fileData: FileData): File {
  const blob = new Blob([], { type: "application/octet-stream" });
  const file = new File([blob], fileData.name || fileData.filename || "file", {
    lastModified: Date.now(),
  });
  return Object.assign(file, {
    size: fileData.size || 0,
  });
}
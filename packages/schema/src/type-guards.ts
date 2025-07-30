import { Question } from "./index";
import type {
  TextQuestion,
  ChoiceQuestion,
  RatingQuestion,
  DateQuestion,
  RankingQuestion,
  FileUploadQuestion,
  AddressQuestion,
  LinearScaleQuestion,
  LikertScaleQuestion,
} from "./question-types";

/**
 * Type guard utilities for Question discriminated union
 * 
 * These functions provide runtime type checking for Question types,
 * replacing unsafe type assertions with proper type narrowing.
 */

export function isTextQuestion(question: Question): question is Question & { type: TextQuestion } {
  return question.type.name === "text";
}

export function isChoiceQuestion(question: Question): question is Question & { type: ChoiceQuestion } {
  return question.type.name === "singleChoice" || question.type.name === "multipleChoice";
}

export function isSingleChoiceQuestion(question: Question): question is Question & { type: ChoiceQuestion & { name: "singleChoice" } } {
  return question.type.name === "singleChoice";
}

export function isMultipleChoiceQuestion(question: Question): question is Question & { type: ChoiceQuestion & { name: "multipleChoice" } } {
  return question.type.name === "multipleChoice";
}

export function isRatingQuestion(question: Question): question is Question & { type: RatingQuestion } {
  return question.type.name === "rating";
}

export function isDateQuestion(question: Question): question is Question & { type: DateQuestion } {
  return question.type.name === "date";
}

export function isRankingQuestion(question: Question): question is Question & { type: RankingQuestion } {
  return question.type.name === "ranking";
}

export function isFileUploadQuestion(question: Question): question is Question & { type: FileUploadQuestion } {
  return question.type.name === "fileUpload";
}

export function isAddressQuestion(question: Question): question is Question & { type: AddressQuestion } {
  return question.type.name === "address";
}

export function isLinearScaleQuestion(question: Question): question is Question & { type: LinearScaleQuestion } {
  return question.type.name === "linearScale";
}

export function isLikertScaleQuestion(question: Question): question is Question & { type: LikertScaleQuestion } {
  return question.type.name === "likertScale";
}

/**
 * Utility type guards for common question characteristics
 */

export function hasOptions(question: Question): question is Question & { type: ChoiceQuestion | RankingQuestion } {
  return isChoiceQuestion(question) || isRankingQuestion(question);
}

export function hasConfig(question: Question): question is Question & { type: RatingQuestion | LinearScaleQuestion } {
  return isRatingQuestion(question) || isLinearScaleQuestion(question);
}

export function isScaleQuestion(question: Question): question is Question & { type: RatingQuestion | LinearScaleQuestion } {
  return isRatingQuestion(question) || isLinearScaleQuestion(question);
}

/**
 * Safe property accessors with validation
 */

export function getQuestionTypeName(question: Question): string {
  if (!question.type?.name) {
    throw new Error(`Invalid question type structure for question ${question.id}`);
  }
  return question.type.name;
}

export function getTextFormat(question: Question): string {
  if (!isTextQuestion(question)) {
    throw new Error(`Question ${question.id} is not a text question`);
  }
  return question.type.format || "text";
}

export function getOptions(question: Question): Array<{ value: string; label: string; score?: number }> {
  if (!hasOptions(question)) {
    throw new Error(`Question ${question.id} does not have options`);
  }
  return question.type.options || [];
}

export function getRatingConfig(question: Question): { min: number; max: number; step: number; minLabel?: string; maxLabel?: string } {
  if (!isRatingQuestion(question)) {
    throw new Error(`Question ${question.id} is not a rating question`);
  }
  return question.type.config;
}

export function getLinearScaleConfig(question: Question): { start: number; end: number; step: number; startLabel?: string; endLabel?: string } {
  if (!isLinearScaleQuestion(question)) {
    throw new Error(`Question ${question.id} is not a linear scale question`);
  }
  return question.type.config;
}
"use client";
import * as React from "react";
import type { Question } from "../../../schema";

export function TypeFormQuestionHeader({
  question,
  questionNumber,
}: {
  question: Question;
  questionNumber?: number;
}) {
  const showNumber = typeof questionNumber === "number" && questionNumber > 0;
  const isRequired = Boolean((question as any)?.validations?.required?.value);
  return (
    <div className="space-y-3">
      <div className="flex flex-col">
        {showNumber && (
          <div className="flex items-center text-muted-foreground text-lg md:text-xl mb-2">
            <span>{questionNumber}</span>
            <svg
              viewBox="0 0 7 8"
              xmlns="http://www.w3.org/2000/svg"
              className="fill-current w-4 h-4 ml-2"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M3.046 1.546a.5.5 0 0 1 .708 0l2.1 2.1a.5.5 0 0 1 0 .707l-2.1 2.1a.5.5 0 1 1-.708-.707L4.293 4.5H.5a.5.5 0 1 1 0-1h3.793L3.046 2.253a.5.5 0 0 1 0-.707Z"
              />
            </svg>
          </div>
        )}
        <div className="space-y-2">
          <h2
            className="text-lg md:text-2xl lg:text-3xl font-medium text-foreground"
            id={`question-title-${question.id}`}
          >
            {question.title}
            {isRequired && <span className="text-destructive ml-1">*</span>}
          </h2>
          {question.description && (
            <p
              className="text-muted-foreground"
              id={`question-description-${question.id}`}
            >
              {question.description as any}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

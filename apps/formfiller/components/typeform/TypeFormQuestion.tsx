"use client";

import React from "react";
import { Question } from "@formlink/schema";
import { motion } from "motion/react";
import { InputContainer } from "@formlink/ui";
import { mapQuestionToUI } from "@/lib/mappers/schema-to-ui";
import { Button } from "@formlink/ui";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib";
import type { QuestionResponse } from "@/lib/types";

interface TypeFormQuestionProps {
  question: Question;
  response: QuestionResponse;
  onAnswer: (
    questionId: string,
    value: QuestionResponse,
    questionType: Question["questionType"],
  ) => void;
  onFileUpload?: (questionId: string, file: File) => Promise<void>;
  uploadedFile?: File | null;
  onFileSelect?: (file: File | null) => void;
  onNext: () => void;
  questionNumber?: number;
}

export default function TypeFormQuestion({
  question,
  response,
  onAnswer,
  onFileUpload,
  uploadedFile,
  onFileSelect,
  onNext,
  questionNumber,
}: TypeFormQuestionProps) {
  // Comprehensive response check for all question types
  const hasResponse = (() => {
    if (response === null || response === undefined) return false;

    switch (question.questionType) {
      case "text":
        return response !== "";
      case "multipleChoice":
        return Array.isArray(response) && response.length > 0;
      case "ranking":
        // Handle JSON string format used by ranking
        if (typeof response === "string") {
          try {
            const parsed = JSON.parse(response);
            return Array.isArray(parsed) && parsed.length > 0;
          } catch {
            return false;
          }
        }
        return Array.isArray(response) && response.length > 0;
      case "fileUpload":
        return uploadedFile !== null;
      case "singleChoice":
        return response !== null && response !== undefined && response !== "";
      case "rating":
      case "linearScale":
        return response !== null && response !== undefined && response !== 0;
      case "likertScale":
        return response !== null && response !== undefined && response !== "";
      case "address":
        return response !== null && response !== undefined;
      case "date":
        return response !== null && response !== undefined && response !== "";
      default:
        return response !== "";
    }
  })();

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-4xl space-y-8">
        {/* Question Text */}
        <div className="space-y-3">
          <div className="flex items-start">
            {questionNumber && (
              <span className="text-xl font-medium text-primary mr-3 flex-shrink-0">
                {questionNumber} →
              </span>
            )}
            <div className="space-y-2 flex-1">
              <h2 className="text-2xl md:text-3xl font-medium text-foreground">
                {question.title}
              </h2>
              {question.description && (
                <p className="text-muted-foreground">{question.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Input Component */}
        <div className={questionNumber ? "ml-[3rem]" : ""}>
          <div className="w-full">
            <InputContainer
              currentQuestion={mapQuestionToUI(question)}
              currentResponse={response}
              handleSelect={(qId: string, value: QuestionResponse) => {
                onAnswer(qId, value, question.questionType);
              }}
              handleFileUpload={onFileUpload}
              uploadedFile={uploadedFile}
              onFileSelect={onFileSelect}
              disabled={false}
              onNext={onNext}
            />
          </div>
        </div>

        {/* Continue button for all question types when they have a response */}
        {hasResponse && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "flex items-center mt-4",
              questionNumber ? "ml-[3rem]" : "",
            )}
          >
            <Button onClick={onNext} size="lg" className="group mr-4">
              Continue
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
            <div className="text-sm text-muted-foreground">
              press{" "}
              <kbd className="px-2 py-1 text-xs border rounded">Enter ↵</kbd>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

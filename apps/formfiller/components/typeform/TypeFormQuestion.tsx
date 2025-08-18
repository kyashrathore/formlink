"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib";
import type { FileData, QuestionResponse } from "@/lib/types";
import { fileDataToFile } from "@/lib/utils";
import { Question, getQuestionTypeName } from "@formlink/schema";
import { Button, InputContainer } from "@formlink/ui";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";

interface TypeFormQuestionProps {
  question: Question;
  response: QuestionResponse;
  onAnswer: (
    questionId: string,
    value: QuestionResponse,
    questionType: string
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
  const isMobile = useIsMobile();
  // Comprehensive response check for all question types
  const hasResponse = (() => {
    if (response === null || response === undefined) return false;

    switch ((question.type as any).name) {
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

  const responseAsFile =
    response instanceof File
      ? response
      : response && typeof response === "object" && "url" in response
        ? fileDataToFile(response as FileData)
        : null;

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-4xl space-y-8">
        {/* Question Text */}
        <div className="space-y-3">
          <div className="flex items-start">
            {questionNumber && (
              <div className="text-lg md:text-2xl lg:text-3xl font-medium text-primary mr-1 md:mr-3 flex-shrink-0 flex items-baseline gap-1 md:gap-2">
                {questionNumber}
                {isMobile ? (
                  <span className="text-sm font-light">•</span>
                ) : (
                  <svg
                    viewBox="0 0 7 8"
                    xmlns="http://www.w3.org/2000/svg"
                    className="shouldFlipIfRtl fill-current w-4 h-4 lg:w-5 lg:h-5 mt-0.5"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M3.046 1.546a.5.5 0 0 1 .708 0l2.1 2.1a.5.5 0 0 1 0 .707l-2.1 2.1a.5.5 0 1 1-.708-.707L4.293 4.5H.5a.5.5 0 1 1 0-1h3.793L3.046 2.253a.5.5 0 0 1 0-.707Z"
                    />
                  </svg>
                )}
              </div>
            )}
            <div className="space-y-2 flex-1">
              <h2 className="text-lg md:text-2xl lg:text-3xl font-medium text-foreground">
                {question.title}
              </h2>
              {question.description && (
                <p className="text-muted-foreground">{question.description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Input Component */}
        <div
          className={questionNumber ? (isMobile ? "ml-4" : "ml-[3rem]") : ""}
        >
          <div className="w-full">
            <InputContainer
              currentQuestion={question}
              currentResponse={
                // Convert FileData to File for UI compatibility
                response && typeof response === 'object' && 'filename' in response
                  ? fileDataToFile(response as FileData)
                  : response as any
              }
              handleSelect={(qId: string, value: QuestionResponse) => {
                onAnswer(qId, value, getQuestionTypeName(question));
              }}
              handleFileUpload={onFileUpload}
              uploadedFile={uploadedFile}
              onFileSelect={onFileSelect}
              disabled={false}
              onNext={onNext}
            />
          </div>
        </div>

        {/* Continue button for all question types when they have a response - hidden on mobile */}
        {hasResponse && !isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn(
              "flex items-center mt-4",
              questionNumber ? "ml-[3rem]" : ""
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

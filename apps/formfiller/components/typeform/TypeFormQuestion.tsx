"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib";
import type { FileData, QuestionResponse } from "@/lib/types";
import { fileDataToFile } from "@/lib/utils";
import { Question, getQuestionTypeName } from "@formlink/schema";
import { Button } from "@formlink/ui";
import { ArrowRight, Loader } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import TypeFormQuestionInputSwitcher from "./TypeFormQuestionInputSwitcher";
import { validateTextValue } from "./utils/validation";

interface TypeFormQuestionProps {
  question: Question;
  response: QuestionResponse;
  onAnswer: (
    questionId: string,
    value: QuestionResponse,
    questionType: string,
  ) => void;
  onFileUpload?: (questionId: string, file: File) => Promise<void>;
  uploadedFile?: File | null;
  onFileSelect?: (file: File | null) => void;
  onNext: () => void;
  questionNumber?: number;
  countryISO2?: string | null;
  isLoadingNext?: boolean;
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
  countryISO2,
  isLoadingNext = false,
}: TypeFormQuestionProps) {
  const isMobile = useIsMobile();
  const [touched, setTouched] = useState(false);

  // Comprehensive response check for all question types
  const hasResponse = (() => {
    if (response === null || response === undefined) return false;

    switch ((question.type as any).name) {
      case "text":
        if ((question.type as any).format === "number") {
          return response !== "" && response !== null && response !== undefined;
        }
        return response !== "";
      case "multipleChoice":
        return Array.isArray(response) && response.length > 0;
      case "ranking":
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
        return typeof response === "string" && response.length > 0;
      case "singleChoice":
        return response !== null && response !== undefined && response !== "";
      case "rating":
      case "linearScale":
        return response !== null && response !== undefined && response !== 0;
      case "likertScale":
        return response !== null && response !== undefined && response !== "";
      case "address": {
        if (response === null || response === undefined) return false;
        let addressResponse = response;
        if (typeof addressResponse === "string") {
          try {
            addressResponse = JSON.parse(addressResponse);
          } catch (e) {
            return false;
          }
        }
        if (typeof addressResponse !== "object" || addressResponse === null) {
          return false;
        }
        const requiredFields = [
          "street1",
          "city",
          "stateProvince",
          "postalCode",
          "country",
        ];
        for (const field of requiredFields) {
          if (!(addressResponse as any)[field]) {
            return false;
          }
        }
        return true;
      }
      case "date":
        return response !== null && response !== undefined && response !== "";
      default:
        return response !== "";
    }
  })();

  const isValid = (() => {
    if ((question.type as any).name === "text") {
      const v = typeof response === "string" ? response : "";
      const format = (question.type as any).format;
      const validations = (question as any).validations || {};
      return validateTextValue(v, format, validations) === null;
    }
    return hasResponse;
  })();

  const errorMessage = (() => {
    if (!touched) return null;

    if ((question.type as any).name === "text") {
      const v = typeof response === "string" ? response : "";
      const format = (question.type as any).format;
      const validations = (question as any).validations || {};
      return validateTextValue(v, format, validations);
    }
    return null;
  })();

  const handleContinueClick = () => {
    if ((question.type as any).name === "address") {
      if ((window as any).triggerAddressSubmit) {
        (window as any).triggerAddressSubmit();
      }
    }
    if (!isValid) {
      setTouched(true);
      return;
    }
    onNext();
  };

  // Normalize response for UI components
  const normalizedResponse =
    response instanceof File
      ? response
      : response && typeof response === "object" && "filename" in response
        ? fileDataToFile(response as FileData)
        : (response as any);

  return (
    <div className="flex-1 flex">
      <div className="w-full max-w-4xl space-y-8">
        {/* Question Text */}
        <div className="space-y-3">
          <div className="flex flex-col">
            {questionNumber && (
              <div className="flex items-center text-muted-foreground text-lg md:text-xl mb-2">
                <span>{questionNumber}</span>
                <svg
                  viewBox="0 0 7 8"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shouldFlipIfRtl fill-current w-4 h-4 ml-2"
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
                {(question as any).validations?.required?.value && (
                  <span className="text-destructive ml-1">*</span>
                )}
              </h2>
              {question.description && (
                <p
                  className="text-muted-foreground"
                  id={`question-description-${question.id}`}
                >
                  {question.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Input Component */}
        <div>
          <div className="w-full">
            <TypeFormQuestionInputSwitcher
              question={question}
              response={normalizedResponse as any}
              onAnswer={(value) => {
                onAnswer(question.id, value, getQuestionTypeName(question));
              }}
              onFileUpload={onFileUpload}
              uploadedFile={uploadedFile}
              onFileSelect={onFileSelect}
              onNext={onNext}
              countryISO2={countryISO2}
              isInvalid={!isValid}
              ariaDescribedBy={
                [
                  question.description
                    ? `question-description-${question.id}`
                    : null,
                  errorMessage ? `question-error-${question.id}` : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
            />
          </div>

          {/* Error region - aria-live for screen readers */}
          {errorMessage && (
            <div
              id={`question-error-${question.id}`}
              className="mt-2 text-sm text-destructive"
              aria-live="polite"
              role="alert"
            >
              {errorMessage}
            </div>
          )}
        </div>

        {/* Continue button always visible on desktop; disabled when invalid */}
        {!isMobile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className={cn("flex items-center mt-4")}
          >
            <Button
              onClick={handleContinueClick}
              variant="default"
              size="lg"
              className="group mr-4"
              disabled={!isValid || isLoadingNext}
            >
              <span>Continue</span>
              {!isLoadingNext && (
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              )}
              {isLoadingNext && <Loader size="sm" className="ml-2" />}
            </Button>
            <div className="text-sm text-muted-foreground">
              press{" "}
              <kbd className="px-2 py-1 text-xs border rounded">Enter ↵</kbd>
            </div>
            {errorMessage && (
              <div className="ml-4 text-sm text-destructive">
                {errorMessage}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

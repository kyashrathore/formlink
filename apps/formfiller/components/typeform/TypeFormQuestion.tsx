"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib";
import type { FileData, QuestionResponse } from "@/lib/types";
import { fileDataToFile } from "@/lib/utils";
import { Question, getQuestionTypeName } from "@formlink/schema";
import { Button } from "@formlink/ui";
import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import TypeFormQuestionInputSwitcher from "./TypeFormQuestionInputSwitcher";

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
}: TypeFormQuestionProps) {
  const isMobile = useIsMobile();
  const [touched, setTouched] = useState(false);

  // Helper function to validate text fields with format-specific rules
  const validateTextValue = (
    value: string,
    format?: string,
    validations?: any,
  ) => {
    if (validations?.required?.value && value.trim() === "") {
      return validations?.required?.message || "This field is required";
    }

    const minL = validations?.minLength?.value;
    if (typeof minL === "number" && value.length < minL) {
      return `Minimum length is ${minL} characters`;
    }

    const maxL = validations?.maxLength?.value;
    if (typeof maxL === "number" && value.length > maxL) {
      return `Maximum length is ${maxL} characters`;
    }

    // Use custom pattern if provided, otherwise apply format-specific validation
    const pattern = validations?.pattern?.value;
    if (pattern && value) {
      try {
        const re = new RegExp(pattern);
        if (!re.test(value)) {
          return validations?.pattern?.message || "Invalid format";
        }
      } catch {
        // ignore invalid regex
      }
    } else if (value && format) {
      // Apply default format validation when no custom pattern
      switch (format) {
        case "email":
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            return "Please enter a valid email address";
          }
          break;
        case "url":
          if (!/^https?:\/\/.+\..+/.test(value)) {
            return "Please enter a valid URL (starting with http:// or https://)";
          }
          break;
        case "tel":
          const digitCount = (value.match(/\d/g) || []).length;
          if (digitCount < 7) {
            return "Please enter a valid phone number";
          }
          break;
        case "number":
          if (!/^-?\d+(\.\d+)?$/.test(value)) {
            return "Please enter a valid number";
          }
          break;
      }
    }

    return null;
  };
  // Comprehensive response check for all question types
  const hasResponse = (() => {
    if (response === null || response === undefined) return false;

    switch ((question.type as any).name) {
      case "text":
        // Check if it's a number format
        if ((question.type as any).format === "number") {
          return response !== "" && response !== null && response !== undefined;
        }
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
      case "address": {
        if (response === null || response === undefined) return false;

        let addressResponse = response;
        if (typeof addressResponse === "string") {
          try {
            addressResponse = JSON.parse(addressResponse);
          } catch (e) {
            return false; // Not a valid JSON string
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
    if (!hasResponse) return false;

    if ((question.type as any).name === "text") {
      const v = typeof response === "string" ? response : "";
      const validations = (question as any).validations || {};
      if (validations?.required?.value && v.trim() === "") return false;

      const minL = validations?.minLength?.value;
      if (typeof minL === "number" && v.length < minL) return false;

      const maxL = validations?.maxLength?.value;
      if (typeof maxL === "number" && v.length > maxL) return false;

      const pattern = validations?.pattern?.value;
      if (pattern && v) {
        try {
          const re = new RegExp(pattern);
          if (!re.test(v)) return false;
        } catch {
          // ignore invalid regex
        }
      }
    }

    return true;
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
        <div
          className={questionNumber ? (isMobile ? "ml-4" : "ml-[3rem]") : ""}
        >
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
            className={cn(
              "flex items-center mt-4",
              questionNumber ? "ml-[3rem]" : "",
            )}
          >
            <Button
              onClick={handleContinueClick}
              variant="default"
              size="lg"
              className="group mr-4"
              disabled={!isValid}
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
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

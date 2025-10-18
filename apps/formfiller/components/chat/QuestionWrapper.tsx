import type { FileData, QuestionResponse } from "@/lib/types";
import { fileDataToFile } from "@/lib/utils";
import { AddressData, Question } from "@formlink/schema";
// Replace generic registry-based InputContainer with explicit Chat switcher
import React from "react";
import { useShallow } from "zustand/shallow";
import ChatQuestionInputSwitcher from "./ChatQuestionInputSwitcher";
import { useChatStore } from "./store/useChatStore";
import { debugLog } from "./utils/debug";

interface QuestionWrapperProps {
  questionId: string;
  messageId: string;
  isLast?: boolean;
  variant: "user" | "assistant";
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
  onSubmitSelection?: (
    questionId: string,
    value: QuestionResponse,
    displayText: string,
  ) => Promise<void>;
}

// Format response based on question type
const formatResponse = (
  question: Question,
  response: QuestionResponse,
): string => {
  if (!response) return "";

  switch (question.type.name) {
    case "singleChoice":
    case "multipleChoice": {
      // Handle both single value and array of values
      const values = Array.isArray(response) ? response : [response];
      const labels = values.map((value) => {
        const typeWithOptions = question.type as {
          options?: { value: string; label: string }[];
        };
        const option = typeWithOptions.options?.find(
          (opt) => opt.value === value,
        );
        return option?.label || value;
      });
      return labels.join(", ");
    }

    case "address": {
      // Format address object
      if (
        typeof response === "object" &&
        response !== null &&
        !Array.isArray(response)
      ) {
        const addr = response as AddressData;
        const addressParts = [];
        if (addr.street1) addressParts.push(addr.street1);
        if (addr.street2) addressParts.push(addr.street2);
        if (addr.city) addressParts.push(addr.city);
        if (addr.stateProvince) addressParts.push(addr.stateProvince);
        if (addr.postalCode) addressParts.push(addr.postalCode);
        if (addr.country) addressParts.push(addr.country);
        return addressParts.join(", ");
      }
      return String(response);
    }

    case "rating": {
      // Show rating with scale
      const ratingType = question.type as { config?: { max: number } };
      const config = ratingType.config;
      if (config) {
        return `${response} out of ${config.max}`;
      }
      return String(response);
    }

    case "linearScale": {
      // Show linear scale value with labels if available
      const scaleType = question.type as {
        config?: {
          start: number;
          end: number;
          startLabel?: string;
          endLabel?: string;
        };
      };
      const config = scaleType.config;
      if (config) {
        let result = String(response);
        if (response === config.start && config.startLabel) {
          result += ` (${config.startLabel})`;
        } else if (response === config.end && config.endLabel) {
          result += ` (${config.endLabel})`;
        }
        return result;
      }
      return String(response);
    }

    case "likertScale": {
      // For Likert scale, the response is the selected option string
      return String(response);
    }

    case "fileUpload": {
      // Handle file upload responses
      if (typeof response === "object" && response !== null) {
        if (Array.isArray(response)) {
          const files = response as FileData[];
          return files
            .map((file) => file.name || file.filename || "File")
            .join(", ");
        }
        if (response instanceof File) {
          return response.name;
        }
        const fileData = response as FileData;
        return fileData.name || fileData.filename || "File uploaded";
      }
      return "File uploaded";
    }

    case "date": {
      // Format date nicely
      if (
        response &&
        (typeof response === "string" || typeof response === "number")
      ) {
        try {
          const date = new Date(response);
          return date.toLocaleDateString();
        } catch {
          return String(response);
        }
      }
      return String(response);
    }

    case "ranking": {
      // Show ranked items in order
      if (Array.isArray(response)) {
        const typeWithOptions = question.type as {
          options?: { value: string; label: string }[];
        };
        return response
          .map((value, index) => {
            const option = typeWithOptions.options?.find(
              (opt) => opt.value === value,
            );
            const label = option?.label || value;
            return `${index + 1}. ${label}`;
          })
          .join(", ");
      }
      return String(response);
    }

    case "signature": {
      // For signature, show a confirmation message instead of the signature data
      return response ? "Signature provided" : "";
    }

    case "text":
    default: {
      // For text and other types, show as-is but truncate if too long
      const text = String(response);
      return text.length > 100 ? text.substring(0, 97) + "..." : text;
    }
  }
};

const QuestionWrapperComponent: React.FC<QuestionWrapperProps> = ({
  questionId,
  messageId,
  isLast,
  variant,
  handleFileUpload,
  onSubmitSelection,
}) => {
  const { formSchema, currentInputs, setCurrentInput, currentQuestionId } =
    useChatStore(
      useShallow((state) => ({
        formSchema: state.formSchema,
        currentInputs: state.currentInputs,
        setCurrentInput: state.setCurrentInput,
        currentQuestionId: state.currentQuestionId,
      })),
    );

  const question = formSchema?.questions.find((q) => q.id === questionId);
  const response = currentInputs[questionId];

  const hasAnswer = React.useCallback(
    (val: QuestionResponse, q: Question): boolean => {
      if (val === undefined || val === null) return false;
      if (Array.isArray(val)) return val.length > 0; // empty arrays are unanswered
      if (typeof val === "string") return val.trim().length > 0;
      if (typeof val === "number") return true;
      if (typeof val === "boolean") return true;
      if (typeof val === "object") {
        if (q.type.name === "address") {
          const obj = val as Record<string, unknown>;
          return Object.values(obj).some(
            (v) => typeof v === "string" && v.trim().length > 0,
          );
        }
        if (q.type.name === "fileUpload") {
          // FileUpload can be File, FileData, or array variants
          const anyVal = val as any;
          if (anyVal instanceof File) return true;
          if (Array.isArray(anyVal)) return anyVal.length > 0;
          if (anyVal && typeof anyVal === "object" && "url" in anyVal)
            return true;
          return false;
        }
        return true;
      }
      return false;
    },
    [],
  );

  // Local preview state to keep the input visible briefly after selection
  const [isPreviewing, setIsPreviewing] = React.useState(false);
  const previewTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const requestPreview = React.useCallback((ms: number) => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    setIsPreviewing(true);
    previewTimerRef.current = setTimeout(() => setIsPreviewing(false), ms);
  }, []);
  React.useEffect(
    () => () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    },
    [],
  );

  if (!question) return null;

  // Simplified visibility rules: show input only for last assistant row until local submit.
  const hasResp = hasAnswer(response ?? null, question);
  const [isSubmitted, setIsSubmitted] = React.useState(false);
  const showInput = variant === "assistant" && Boolean(isLast) && !isSubmitted;
  const showUserSummary = variant === "user" && hasResp;
  debugLog("QuestionWrapper visibility", {
    isLast,
    isSubmitted,
    showInput,
    showUserSummary,
  });

  // Define response variables BEFORE any early returns to avoid undefined references
  const responseAsFile =
    response instanceof File
      ? response
      : Array.isArray(response) &&
          response.length > 0 &&
          response[0] instanceof File
        ? response[0] // Extract the File from array
        : response && typeof response === "object" && "url" in response
          ? fileDataToFile(response as FileData)
          : Array.isArray(response) &&
              response.length > 0 &&
              response[0] &&
              typeof response[0] === "object" &&
              "url" in response[0]
            ? fileDataToFile(response[0] as FileData)
            : null;

  // For non-file question types, pass the response directly (not responseAsFile which is for files)
  const isFileType = question.type.name === "fileUpload";
  const currentResponseValue: QuestionResponse = isFileType
    ? responseAsFile
    : (response ?? null);

  // For user variant, render a compact summary bubble if we have an answer.
  if (!showInput && showUserSummary) {
    return (
      <div className="bg-muted/50 px-4 py-2 rounded-lg inline-block">
        <span className="text-sm">
          {formatResponse(question, (response ?? null) as QuestionResponse)}
        </span>
      </div>
    );
  }

  if (!showInput) return null;

  return (
    <div className="mt-2 sm:mt-3">
      <ChatQuestionInputSwitcher
        question={question}
        response={currentResponseValue}
        onAnswer={(value: QuestionResponse) => {
          setCurrentInput(question.id, value);
        }}
        onPreviewSelection={requestPreview}
        onNext={() => {
          setIsSubmitted(true);
          const currentValue =
            useChatStore.getState().currentInputs[question.id];
          if (currentValue && onSubmitSelection) {
            const formattedResponse = formatResponse(question, currentValue);
            onSubmitSelection(question.id, currentValue, formattedResponse);
          }
        }}
        onFileUpload={handleFileUpload}
        uploadedFile={responseAsFile}
        onFileSelect={(file: File | null) => {
          if (file && handleFileUpload) {
            handleFileUpload(question.id, file);
          } else {
            setCurrentInput(question.id, null);
          }
        }}
      />
    </div>
  );
};

export const QuestionWrapper = React.memo(
  QuestionWrapperComponent,
  (prev, next) =>
    prev.questionId === next.questionId &&
    prev.messageId === next.messageId &&
    prev.isLast === next.isLast &&
    prev.variant === next.variant &&
    prev.handleFileUpload === next.handleFileUpload &&
    prev.onSubmitSelection === next.onSubmitSelection,
);

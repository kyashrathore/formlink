import type { FileData, QuestionResponse } from "@/lib/types";
import { fileDataToFile } from "@/lib/utils";
import { AddressData, Question } from "@formlink/schema";
// Replace generic registry-based InputContainer with explicit Chat switcher
import ChatQuestionInputSwitcher from "./ChatQuestionInputSwitcher";
import React from "react";
import { useChatStore } from "./store/useChatStore";

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

export const QuestionWrapper: React.FC<QuestionWrapperProps> = ({
  questionId,
  isLast,
  variant,
  handleFileUpload,
  onSubmitSelection,
}) => {
  const store = useChatStore();
  const { formSchema, currentInputs, setCurrentInput, currentQuestionId } =
    store;

  const question = formSchema?.questions.find((q) => q.id === questionId);
  const response = currentInputs[questionId];

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

  // For multi-select: need special handling because values can be selected before submission
  const isMultiSelect = question.type.name === "multipleChoice";

  // For address: need special handling because partial data doesn't mean submission
  const isAddress = question.type.name === "address";

  // For ranking: need special handling because ranking in progress doesn't mean submission
  const isRanking = question.type.name === "ranking";

  // For tel (phone): do not hide input just because a partial value exists (e.g., after selecting country)
  const isTel =
    question.type.name === "text" &&
    (question.type as unknown as { format?: string }).format === "tel";

  // For file upload: need special handling because file selection doesn't mean submission
  const isFileUpload = question.type.name === "fileUpload";

  // A multi-select is considered "submitted" when:
  // 1. It has a response AND
  // 2. Either it's not the last message OR it's not the current question being interacted with
  const isMultiSelectSubmitted =
    isMultiSelect && response && (!isLast || currentQuestionId !== questionId);

  // An address is considered "submitted" when:
  // 1. It has a response AND
  // 2. It's not the current question being interacted with
  const isAddressSubmitted =
    isAddress && response && currentQuestionId !== questionId;

  // A ranking is considered "submitted" when:
  // 1. It has a response AND
  // 2. It's not the current question being interacted with
  const isRankingSubmitted =
    isRanking && response && currentQuestionId !== questionId;

  // A file upload is considered "submitted" when:
  // 1. It has a response AND
  // 2. It's not the current question being interacted with
  const isFileUploadSubmitted =
    isFileUpload && response && currentQuestionId !== questionId;

  // A tel input is considered "submitted" only when it's not the current question
  const isTelSubmitted = isTel && response && currentQuestionId !== questionId;

  // Hide input if:
  // - For address: has been explicitly submitted (not just filled)
  // - For multi-select: has been submitted (not just selected)
  // - For ranking: has been explicitly submitted (not just ranked)
  // - For file upload: has been explicitly submitted (not just selected)
  // - For other types: has any response
  const baseShouldHideInput =
    response &&
    (isAddress
      ? isAddressSubmitted
      : isMultiSelect
        ? isMultiSelectSubmitted
        : isRanking
          ? isRankingSubmitted
          : isFileUpload
            ? isFileUploadSubmitted
            : isTel
              ? isTelSubmitted
              : true);
  const shouldHideInput = baseShouldHideInput && !isPreviewing;

  if (shouldHideInput) {
    if (variant === "user") {
      return (
        <div className="bg-muted/50 px-4 py-2 rounded-lg inline-block">
          <span className="text-sm">{formatResponse(question, response)}</span>
        </div>
      );
    }
    // Show nothing on assistant side for answered questions
    return null;
  }

  if (isLast && variant === "assistant") {
    // Note: When presentQuestion tool explicitly calls this component,
    // we should always render input components regardless of question type
    // The old logic that skipped basic text questions is disabled for tool-based rendering
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
  }

  return null;
};

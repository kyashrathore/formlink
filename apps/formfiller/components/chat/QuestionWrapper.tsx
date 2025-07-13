import React, { useEffect, useRef } from 'react';
import { useChatStore } from './store/useChatStore';
import { InputContainer } from '@formlink/ui';
import { Question } from '@formlink/schema';
import { mapQuestionToUI } from '@/lib/mappers/schema-to-ui';

interface QuestionWrapperProps {
  questionId: string;
  messageId: string;
  isLast?: boolean;
  variant: 'user' | 'assistant';
  handleFileUpload?: (questionId: string, file: File) => Promise<void>;
}

// Format response based on question type
const formatResponse = (question: Question, response: any): string => {
  if (!response) return '';

  switch (question.questionType) {
    case 'singleChoice':
    case 'multipleChoice': {
      // Handle both single value and array of values
      const values = Array.isArray(response) ? response : [response];
      const labels = values.map(value => {
        const option = question.options?.find(opt => opt.value === value);
        return option?.label || value;
      });
      return labels.join(', ');
    }

    case 'address': {
      // Format address object
      if (typeof response === 'object' && response !== null) {
        const addressParts = [];
        if (response.street1) addressParts.push(response.street1);
        if (response.street2) addressParts.push(response.street2);
        if (response.city) addressParts.push(response.city);
        if (response.stateProvince) addressParts.push(response.stateProvince);
        if (response.postalCode) addressParts.push(response.postalCode);
        if (response.country) addressParts.push(response.country);
        return addressParts.join(', ');
      }
      return String(response);
    }

    case 'rating': {
      // Show rating with scale
      const config = question.ratingConfig;
      if (config) {
        return `${response} out of ${config.max}`;
      }
      return String(response);
    }

    case 'linearScale': {
      // Show linear scale value with labels if available
      const config = question.linearScaleConfig;
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

    case 'likertScale': {
      // For Likert scale, the response is the selected option string
      return String(response);
    }

    case 'fileUpload': {
      // Handle file upload responses
      if (typeof response === 'object' && response !== null) {
        if (Array.isArray(response)) {
          return response.map(file => file.name || file.filename || 'File').join(', ');
        }
        return response.name || response.filename || 'File uploaded';
      }
      return 'File uploaded';
    }

    case 'date': {
      // Format date nicely
      if (response) {
        try {
          const date = new Date(response);
          return date.toLocaleDateString();
        } catch {
          return String(response);
        }
      }
      return String(response);
    }

    case 'ranking': {
      // Show ranked items in order
      if (Array.isArray(response)) {
        return response.map((value, index) => {
          const option = question.options?.find(opt => opt.value === value);
          const label = option?.label || value;
          return `${index + 1}. ${label}`;
        }).join(', ');
      }
      return String(response);
    }

    case 'text':
    default: {
      // For text and other types, show as-is but truncate if too long
      const text = String(response);
      return text.length > 100 ? text.substring(0, 97) + '...' : text;
    }
  }
};

export const QuestionWrapper: React.FC<QuestionWrapperProps> = ({ questionId, messageId, isLast, variant, handleFileUpload }) => {
  const {
    formSchema,
    currentInputs,
    setCurrentInput,
    setTriggerUserMessageForSelection,
    formDisplayState,
    currentQuestionId,
    setCurrentQuestionId,
  } = useChatStore();

  const question = formSchema?.questions.find((q) => q.id === questionId);
  const response = currentInputs[questionId];
  
  // Use ref to track if we've updated for this specific question
  const hasUpdatedRef = useRef<string | null>(null);

  // Backup mechanism: Update currentQuestionId if it's stale
  useEffect(() => {
    // Only update if:
    // 1. This is the last assistant message
    // 2. Question has no response yet
    // 3. Current question ID doesn't match
    // 4. We haven't already updated for this question
    if (isLast && 
        variant === 'assistant' && 
        !response && 
        question &&
        currentQuestionId !== questionId &&
        hasUpdatedRef.current !== questionId) {
      
      hasUpdatedRef.current = questionId;
      
      // Use setTimeout to defer update to next tick, preventing render loops
      const timeoutId = setTimeout(() => {
        setCurrentQuestionId(questionId);
      }, 0);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isLast, variant, response, question, questionId]); // Note: currentQuestionId NOT in deps


  if (!question) return null;

  // For multi-select: need special handling because values can be selected before submission
  const isMultiSelect = question.questionType === 'multipleChoice';
  
  // For address: need special handling because partial data doesn't mean submission
  const isAddress = question.questionType === 'address';
  
  // For ranking: need special handling because ranking in progress doesn't mean submission
  const isRanking = question.questionType === 'ranking';
  
  // For file upload: need special handling because file selection doesn't mean submission
  const isFileUpload = question.questionType === 'fileUpload';
  
  // A multi-select is considered "submitted" when:
  // 1. It has a response AND
  // 2. Either it's not the last message OR it's not the current question being interacted with
  const isMultiSelectSubmitted = isMultiSelect && response && (
    !isLast || currentQuestionId !== questionId
  );
  
  // An address is considered "submitted" when:
  // 1. It has a response AND
  // 2. It's not the current question being interacted with
  const isAddressSubmitted = isAddress && response && currentQuestionId !== questionId;
  
  // A ranking is considered "submitted" when:
  // 1. It has a response AND
  // 2. It's not the current question being interacted with
  const isRankingSubmitted = isRanking && response && currentQuestionId !== questionId;
  
  // A file upload is considered "submitted" when:
  // 1. It has a response AND
  // 2. It's not the current question being interacted with
  const isFileUploadSubmitted = isFileUpload && response && currentQuestionId !== questionId;

  // Hide input if:
  // - For address: has been explicitly submitted (not just filled)
  // - For multi-select: has been submitted (not just selected)
  // - For ranking: has been explicitly submitted (not just ranked)
  // - For file upload: has been explicitly submitted (not just selected)
  // - For other types: has any response
  const shouldHideInput = response && (
    isAddress ? isAddressSubmitted :
    isMultiSelect ? isMultiSelectSubmitted :
    isRanking ? isRankingSubmitted :
    isFileUpload ? isFileUploadSubmitted :
    true
  );
  
  if (shouldHideInput) {
    if (variant === 'user') {
      return (
        <div className="bg-muted/50 px-4 py-2 rounded-lg inline-block">
          <span className="text-sm">{formatResponse(question, response)}</span>
        </div>
      );
    }
    // Show nothing on assistant side for answered questions
    return null;
  }

  if (isLast && variant === 'assistant') {
    // Only skip plain text questions without specific input requirements
    // Allow structured inputs like email, tel, url, etc. and questions with validations
    if (question.questionType === 'text' && 
        question.display.inputType === 'text' &&
        !question.validations?.pattern &&
        !question.validations?.minLength &&
        !question.validations?.maxLength &&
        !(question as any).placeholder?.includes('@') && // Allow email-like inputs
        !(question as any).placeholder?.includes('phone') && // Allow phone-like inputs
        !(question as any).placeholder?.includes('url')) { // Allow URL-like inputs
      return null;
    }
    
    return (
      <InputContainer
        currentQuestion={mapQuestionToUI(question)}
        currentResponse={response}
        handleSelect={(qId: string, value: any) => {
          setCurrentInput(qId, value);
          
          // For single select and other types, trigger submission immediately
          // Multi-select, address, ranking, and file upload will trigger via onNext when Continue is clicked
          if (question.questionType !== 'multipleChoice' && 
              question.questionType !== 'address' && 
              question.questionType !== 'ranking' && 
              question.questionType !== 'fileUpload' &&
              value) {
            setTriggerUserMessageForSelection(
              messageId,
              qId,
              value,
              formatResponse(question, value)
            );
          }
        }}
        handleFileUpload={handleFileUpload}
        isUploading={formDisplayState === 'uploading_file'}
        uploadedFile={response ? (response as File) : null}
        onFileSelect={(file: File | null) => {
          // Chat mode: Store file directly as response
          if (file) {
            setCurrentInput(question.id, file);
          } else {
            setCurrentInput(question.id, null);
          }
        }}
        onNext={() => {
          // Get the current value from the store, not the stale closure value
          const currentValue = useChatStore.getState().currentInputs[question.id];
          if (currentValue) {
            setTriggerUserMessageForSelection(
              messageId,
              question.id,
              currentValue,
              formatResponse(question, currentValue)
            );
          }
        }}
      />
    );
  }

  return null;
};

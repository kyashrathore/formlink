"use client";

import React from "react";
import { Form, Question } from "@formlink/schema";
import type { UIForm } from "@formlink/ui";
import FormAIComponent from "@/app/[formId]/FormAIComponent";
import TypeFormView from "@/components/typeform/TypeFormView";
import { FormModeProvider, useFormMode } from "@/contexts/FormModeContext";
import { mapFormToUI } from "@/lib/mappers/schema-to-ui";
import { useAppFormStore } from "@/lib/stores/useAppFormStore";

interface FormPageContentProps {
  formSchema: Form;
  isTestSubmission: boolean;
  queryDataForForm: Record<string, any>;
}

// This component must be used INSIDE FormModeProvider
function FormPageContent({
  formSchema,
  isTestSubmission,
  queryDataForForm,
}: FormPageContentProps) {
  const { isAIMode, isTypeFormMode } = useFormMode();

  // Convert schema to UI format for components
  const uiFormSchema = mapFormToUI(formSchema);

  // Business logic from app store
  const {
    questions,
    questionResponses,
    isCompleted,
    initialize,
    restart,
    setQuestionResponse,
    handleSingleChoiceChange,
    handleMultipleChoiceChange,
    handleTextChange,
    shouldShowQuestion,
    getNextValidQuestionIndex,
    markAsCompleted,
    handleFileUpload,
    getCurrentQuestion,
    getProgress,
  } = useAppFormStore();

  const handleStartQuiz = () => {
    // Business logic for starting quiz (if any additional logic needed)
  };

  const handleAnswerChange = (
    questionId: string,
    value: any,
    questionType: Question["questionType"],
  ) => {
    // Route to appropriate business logic based on question type
    switch (questionType) {
      case "singleChoice":
        handleSingleChoiceChange(questionId, value);
        break;
      case "multipleChoice":
        if (Array.isArray(value)) {
          setQuestionResponse(questionId, value);
        }
        break;
      case "ranking":
        // Store ranking as JSON string
        if (Array.isArray(value)) {
          setQuestionResponse(questionId, JSON.stringify(value));
        } else if (typeof value === "string") {
          setQuestionResponse(questionId, value);
        }
        break;
      default:
        handleTextChange(questionId, value);
        break;
    }
  };

  if (isAIMode) {
    return (
      <FormAIComponent
        formId={formSchema.id}
        formSchema={formSchema}
        uiFormSchema={uiFormSchema}
        isTestSubmission={isTestSubmission}
        queryDataForForm={queryDataForForm}
      />
    );
  }

  // Default to TypeForm mode if not in AI mode
  return (
    <TypeFormView
      formSchema={formSchema}
      uiFormSchema={uiFormSchema}
      formId={formSchema.id}
      // Props down: business state
      questions={questions}
      questionResponses={questionResponses}
      isCompleted={isCompleted}
      // Callbacks up: business actions
      onInitialize={initialize}
      onStartQuiz={handleStartQuiz}
      onRestart={restart}
      onAnswerChange={handleAnswerChange}
      onFileUpload={handleFileUpload}
      onNavigateNext={getNextValidQuestionIndex}
      onMarkCompleted={markAsCompleted}
      shouldShowQuestion={shouldShowQuestion}
      getCurrentQuestion={getCurrentQuestion}
      getProgress={getProgress}
    />
  );
}

interface FormPageClientProps {
  formSchema: Form;
  isTestSubmission: boolean;
  queryDataForForm: Record<string, any>;
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function FormPageClient({
  formSchema,
  isTestSubmission,
  queryDataForForm,
  searchParams,
}: FormPageClientProps) {
  // Extract default mode from form settings
  const defaultMode = formSchema.settings?.defaultMode as
    | "ai"
    | "typeform"
    | undefined;

  // Convert search params to the format expected by FormModeProvider
  const urlSearchParams = {
    mode:
      typeof searchParams?.mode === "string" ? searchParams.mode : undefined,
    aimode:
      typeof searchParams?.aimode === "string"
        ? searchParams.aimode
        : undefined,
  };

  return (
    <FormModeProvider
      defaultMode={defaultMode || "ai"}
      formSettings={{ defaultMode }}
      urlSearchParams={urlSearchParams}
    >
      <div className="h-full">
        <FormPageContent
          formSchema={formSchema}
          isTestSubmission={isTestSubmission}
          queryDataForForm={queryDataForForm}
        />
      </div>
    </FormModeProvider>
  );
}

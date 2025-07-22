"use client";

import React from "react";
import { Form, Question } from "@formlink/schema";
import type { UIForm } from "@formlink/ui";
import FormAIComponent from "@/app/[formId]/FormAIComponent";
import TypeFormView from "@/components/typeform/TypeFormView";
import { FormModeProvider, useFormMode } from "@/contexts/FormModeContext";
import { mapFormToUI } from "@/lib/mappers/schema-to-ui";
import { useAppFormStore } from "@/lib/stores/useAppFormStore";
import { useThemeLoader } from "@/hooks/useThemeLoader";

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

  // Load and apply themes from database
  const themeLoader = useThemeLoader(formSchema);

  // Log theme loading status for debugging
  React.useEffect(() => {
    if (!themeLoader.isLoading) {
      if (themeLoader.themeApplied) {
      } else if (themeLoader.error) {
        console.error(
          `Form ${formSchema.id}: Theme loading failed:`,
          themeLoader.error,
        );
      } else {
      }
    }
  }, [
    themeLoader.isLoading,
    themeLoader.themeApplied,
    themeLoader.error,
    themeLoader.appliedVariables.length,
    formSchema.id,
  ]);

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

  // Show minimal loading state while theme is being applied to prevent content flash
  if (themeLoader.isLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading form...</p>
        </div>
      </div>
    );
  }

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

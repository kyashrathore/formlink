"use client";

import FormAIComponent from "@/app/[formId]/FormAIComponent";
import TypeFormView from "@/components/typeform/TypeFormView";
import ClassicFormView from "@/components/classic/ClassicFormView";
import { FormModeProvider, useFormMode } from "@/contexts/FormModeContext";
import { useThemeLoader } from "@/hooks/useThemeLoader";
import { useAppFormStore } from "@/lib/stores/useAppFormStore";
import type { QueryDataForForm, QuestionResponse } from "@/lib/types";
import { Form } from "@formlink/schema";
import React from "react";

interface FormPageContentProps {
  formSchema: Form;
  isTestSubmission: boolean;
  queryDataForForm: QueryDataForForm;
}

// This component must be used INSIDE FormModeProvider
function FormPageContent({
  formSchema,
  isTestSubmission,
  queryDataForForm,
}: FormPageContentProps) {
  const { isAIMode, isClassicMode } = useFormMode();

  // Load and apply themes from database
  const themeLoader = useThemeLoader(formSchema);

  // Removed debug logs for theme loading status
  React.useEffect(() => {
    // no-op: previously logged theme load results
  }, [
    themeLoader.isLoading,
    themeLoader.themeApplied,
    themeLoader.error,
    formSchema.id,
  ]);

  // Questions are available directly from formSchema.questions

  // Business logic from app store
  const {
    questionResponses,
    isCompleted,
    initialize,
    restart,
    setQuestionResponse,
    handleSingleChoiceChange,
    handleTextChange,
    shouldShowQuestion,
    getNextValidQuestionIndex,
    markAsCompleted,
    submitForm,
    handleFileUpload,
    getCurrentQuestion,
    getProgress,
  } = useAppFormStore();

  // Initialize wrapper to seed query params and testmode for Typeform/Classic
  const handleInitialize = React.useCallback(
    async (schema: Form, id?: string) => {
      await initialize(schema, id);
    },
    [initialize, isTestSubmission, queryDataForForm],
  );

  const handleStartQuiz = () => {
    // Business logic for starting quiz (if any additional logic needed)
  };

  const handleAnswerChange = (
    questionId: string,
    value: QuestionResponse,
    questionType: string,
  ) => {
    // Route to appropriate business logic based on question type
    switch (questionType) {
      case "singleChoice":
        if (typeof value === "string") {
          handleSingleChoiceChange(questionId, value);
        }
        break;
      case "multipleChoice":
        if (Array.isArray(value)) {
          setQuestionResponse(questionId, value);
        }
        break;
      case "ranking":
        if (Array.isArray(value)) {
          setQuestionResponse(questionId, value);
        }
        break;
      case "address":
        if (typeof value === "object" && value !== null) {
          setQuestionResponse(questionId, value);
        }
        break;
      case "rating":
      case "linearScale":
        if (typeof value === "number") {
          setQuestionResponse(questionId, value);
        }
        break;
      case "likertScale":
        // Likert scale uses labeled options (strings)
        if (typeof value === "string") {
          setQuestionResponse(questionId, value);
        }
        break;
      case "date":
        // Handle both Date objects and strings
        setQuestionResponse(questionId, value);
        break;
      default:
        if (typeof value === "string") {
          handleTextChange(questionId, value);
        }
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
        isTestSubmission={isTestSubmission}
        queryDataForForm={queryDataForForm}
      />
    );
  }

  if (isClassicMode) {
    return (
      <ClassicFormView
        formSchema={formSchema}
        formId={formSchema.id}
        // Props down: business state
        questionResponses={questionResponses}
        isCompleted={isCompleted}
        // Callbacks up: business actions
        onInitialize={handleInitialize}
        onStartQuiz={handleStartQuiz}
        onRestart={restart}
        onAnswerChange={handleAnswerChange}
        onFileUpload={handleFileUpload}
        onNavigateNext={getNextValidQuestionIndex}
        onMarkCompleted={markAsCompleted}
        onSubmitForm={submitForm}
        shouldShowQuestion={shouldShowQuestion}
        getCurrentQuestion={getCurrentQuestion}
        getProgress={getProgress}
      />
    );
  }

  // Default to TypeForm mode if not in AI or Classic mode
  return (
    <TypeFormView
      formSchema={formSchema}
      formId={formSchema.id}
      // Props down: business state
      questionResponses={questionResponses}
      isCompleted={isCompleted}
      // Callbacks up: business actions
      onInitialize={handleInitialize}
      onStartQuiz={handleStartQuiz}
      onRestart={restart}
      onAnswerChange={handleAnswerChange}
      onFileUpload={handleFileUpload}
      onNavigateNext={getNextValidQuestionIndex}
      onSubmitForm={submitForm}
      shouldShowQuestion={shouldShowQuestion}
      getCurrentQuestion={getCurrentQuestion}
      getProgress={getProgress}
    />
  );
}

interface FormPageClientProps {
  formSchema: Form;
  isTestSubmission: boolean;
  queryDataForForm: QueryDataForForm;
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
    | "classic"
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

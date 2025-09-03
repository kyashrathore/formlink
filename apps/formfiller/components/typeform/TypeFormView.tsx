"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import type { QuestionResponse } from "@/lib/types";
import { Form, getQuestionTypeName, Question } from "@formlink/schema";
import {
  CompletionScreen,
  FormModeProvider,
  IntroScreen,
  TypeFormOverlayProvider,
} from "@formlink/ui";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTypeFormKeyboard } from "./hooks/useTypeFormKeyboard";
import { useTypeFormScroll } from "./hooks/useTypeFormScroll";
import { useTypeFormSwipe } from "./hooks/useTypeFormSwipe";
import KeyboardShortcutModal from "./KeyboardShortcutModal";
import TypeFormLayout from "./TypeFormLayout";
import TypeFormNavigation from "./TypeFormNavigation";
import TypeFormProgress from "./TypeFormProgress";
import TypeFormQuestion from "./TypeFormQuestion";
import TypeFormTransition from "./TypeFormTransition";
import { validateTextValue } from "./utils/validation";

interface TypeFormViewProps {
  formSchema: Form;
  formId?: string;
  // Props down: business state
  questionResponses: Record<string, QuestionResponse>;
  isCompleted: boolean;
  // Callbacks up: business actions
  onInitialize: (schema: Form, id?: string) => Promise<void>;
  onStartQuiz: () => void;
  onRestart: () => Promise<void>;
  onAnswerChange: (
    questionId: string,
    value: QuestionResponse,
    questionType: string,
  ) => void;
  onFileUpload: (questionId: string, file: File) => Promise<string | null>;
  onNavigateNext: (currentIndex: number) => number | null;
  onSubmitForm: () => Promise<boolean>;
  shouldShowQuestion: (question: Question) => boolean;
  getCurrentQuestion: (activeIndex: number) => Question | null;
  getProgress: (activeIndex: number) => number;
}

export default function TypeFormView({
  formSchema,
  formId,
  questionResponses,
  isCompleted,
  onInitialize,
  onStartQuiz,
  onRestart,
  onAnswerChange,
  onFileUpload,
  onNavigateNext,
  onSubmitForm,
  shouldShowQuestion,
  getCurrentQuestion,
  getProgress,
}: TypeFormViewProps) {
  const isMobileView = useIsMobile();
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [direction, setDirection] = useState(1);
  const [, setIsLoading] = useState(false);

  // Local UI state (previously from useFormUIStore)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(-1); // -1 for intro screen
  const [showConfetti, setShowConfetti] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [lastAnsweredQ, setLastAnsweredQ] = useState<{
    id: string;
    value: QuestionResponse;
  } | null>(null);

  // Gate auto-advance: only after fresh interaction on this question
  const activatedAtRef = useRef(0);
  const lastInteractionAtRef = useRef(0);

  // Navigation history for proper backward navigation with AI branching
  const [navigationHistory, setNavigationHistory] = useState<number[]>([-1]);

  const currentQuestion: Question | null =
    getCurrentQuestion(activeQuestionIndex);

  useEffect(() => {
    if (formSchema) {
      onInitialize(formSchema, formId);
    }
  }, [formSchema, formId, onInitialize]); // Initialize on mount

  // AI Branching logic
  const handleAIBranching = useCallback(
    async (currentQuestion: Question) => {
      try {
        const response = await fetch("/api/ai/branching", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            journeyScript: formSchema.settings?.journeyScript || "",
            answerHistory: questionResponses,
            questions: formSchema.questions,
            currentQuestionId: currentQuestion.id,
          }),
        });

        if (!response.ok) {
          throw new Error("Branching API failed");
        }

        const { nextQuestionId } = await response.json();

        // Find the index of the next question
        const nextIndex = formSchema.questions.findIndex(
          (q) => q.id === nextQuestionId,
        );

        if (nextIndex !== -1) {
          setActiveQuestionIndex(nextIndex);
          // Add to navigation history for proper backward navigation
          setNavigationHistory((prev) => [...prev, nextIndex]);
          activatedAtRef.current = Date.now();
          return true; // Successfully branched
        }
      } catch (error) {
        console.error("AI branching failed:", error);
      }

      return false; // Branching failed, use default navigation
    },
    [formSchema, questionResponses],
  );

  const isQuestionValid = useCallback(
    (q: Question | null, resp: QuestionResponse) => {
      if (!q) return false;

      if (q.type.name === "text") {
        const v = typeof resp === "string" ? resp : "";
        const format = (q.type as any).format;
        const validations = (q as any).validations || {};
        return validateTextValue(v, format, validations) === null;
      }

      // For non-text types, require any non-null/non-empty response
      if (Array.isArray(resp)) {
        return resp.length > 0;
      }
      return resp != null && resp !== "";
    },
    [questionResponses],
  );

  const handleNextWithDirection = useCallback(async () => {
    const currentQ = getCurrentQuestion(activeQuestionIndex);
    const currentResponse = questionResponses[currentQ?.id || ""];
    const valid = isQuestionValid(currentQ, currentResponse);

    setDirection(1); // Going forwards
    // Block navigation only after intro (index >= 0)
    if (activeQuestionIndex >= 0 && !valid) {
      return;
    }

    // Check if current question should trigger AI branching
    if (currentQ?.mightBranchOffNext && formSchema.settings?.journeyScript) {
      const branchingSucceeded = await handleAIBranching(currentQ);
      if (branchingSucceeded) return; // AI handled the navigation
    }

    // Default navigation logic
    const nextIndex = onNavigateNext(activeQuestionIndex);
    if (nextIndex !== null) {
      setActiveQuestionIndex(nextIndex);
      // Add to navigation history for proper backward navigation
      setNavigationHistory((prev) => [...prev, nextIndex]);
      activatedAtRef.current = Date.now();
    } else {
      // No more questions, submit form to API
      const success = await onSubmitForm();
      if (success) {
        setShowConfetti(true);
        setActiveQuestionIndex(formSchema.questions.length);
      } else {
        console.error("Failed to submit form");
      }
    }
  }, [
    activeQuestionIndex,
    getCurrentQuestion,
    handleAIBranching,
    formSchema,
    onNavigateNext,
    onSubmitForm,
    isQuestionValid,
    questionResponses,
  ]);

  useEffect(() => {
    if (activeQuestionIndex < 0 || isCompleted || !currentQuestion) return;
    if (currentQuestion && !shouldShowQuestion(currentQuestion)) {
      handleNextWithDirection();
    }
  }, [
    activeQuestionIndex,
    questionResponses,
    currentQuestion,
    shouldShowQuestion,
    isCompleted,
    handleNextWithDirection,
  ]);

  const handleAnswerChange = (
    questionId: string,
    value: QuestionResponse,
    questionType: string,
  ) => {
    onAnswerChange(questionId, value, questionType);
    setLastAnsweredQ({ id: questionId, value });
    lastInteractionAtRef.current = Date.now();
  };

  // Reactive auto-advance logic for all applicable inputs
  useEffect(() => {
    if (!lastAnsweredQ || !currentQuestion) return;

    // Only auto-advance if the change was for the currently active question
    if (lastAnsweredQ.id !== currentQuestion.id) return;

    const autoAdvanceTypes = [
      "singleChoice",
      "rating",
      "linearScale",
      "likertScale",
      "fileUpload", // Re-added to the reactive flow
    ];
    const questionType = getQuestionTypeName(currentQuestion);

    const isFreshInteraction =
      lastInteractionAtRef.current > activatedAtRef.current;

    if (
      autoAdvanceTypes.includes(questionType) &&
      isQuestionValid(currentQuestion, lastAnsweredQ.value) &&
      isFreshInteraction
    ) {
      // Use a small timeout to allow the UI to update before navigating
      const timer = setTimeout(() => {
        handleNextWithDirection();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [
    lastAnsweredQ,
    currentQuestion,
    isQuestionValid,
    handleNextWithDirection,
  ]);

  const handlePrevious = useCallback(() => {
    // Prevent navigating back from the first question to the intro screen
    if (activeQuestionIndex <= 0) return;

    if (navigationHistory.length > 1) {
      setDirection(-1); // Going backwards
      const newHistory = [...navigationHistory];
      newHistory.pop();
      const previousIndex = newHistory[newHistory.length - 1];
      if (previousIndex !== undefined) {
        setNavigationHistory(newHistory);
        setActiveQuestionIndex(previousIndex);
        activatedAtRef.current = Date.now();
      }
    }
  }, [activeQuestionIndex, navigationHistory]);

  useTypeFormKeyboard({
    currentQuestion: currentQuestion,
    onAnswer: handleAnswerChange,
    onNext: handleNextWithDirection,
    onPrevious: handlePrevious,
    showHelp: () => setShowKeyboardHelp(true),
    getCurrentResponse: (questionId: string) =>
      questionResponses[questionId] ?? null,
    isCurrentQuestionValid: isQuestionValid(
      currentQuestion,
      questionResponses[currentQuestion?.id || ""],
    ),
  });

  useTypeFormScroll({
    onNext: handleNextWithDirection,
    onPrevious: handlePrevious,
  });

  useTypeFormSwipe({
    onNext: handleNextWithDirection,
    onPrevious: handlePrevious,
  });

  const handleStartQuiz = () => {
    onStartQuiz();
    handleNextWithDirection();
  };

  const handleRestart = async () => {
    await onRestart();
    setShowConfetti(false);
    setActiveQuestionIndex(-1);
    setNavigationHistory([-1]);
  };

  const handleFileUploadWrapper = async (questionId: string, file: File) => {
    setIsLoading(true);
    try {
      const url = await onFileUpload(questionId, file);
      if (url) {
        // The only job is to update state. The reactive useEffect will handle navigation.
        handleAnswerChange(questionId, url, "fileUpload");
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "File upload failed";
      alert(`Upload Error: ${errorMessage}`);
      console.error("File upload error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (activeQuestionIndex === -1 && !isCompleted) {
      return <IntroScreen formSchema={formSchema} onStart={handleStartQuiz} />;
    }

    if (isCompleted) {
      return (
        <CompletionScreen
          isMobileView={isMobileView}
          showConfetti={showConfetti}
          onRestart={handleRestart}
        />
      );
    }

    if (currentQuestion) {
      let selectedCountryISO2: string | null = null;
      try {
        const countryQ = formSchema.questions.find(
          (q) =>
            (q.type as any).name === "text" &&
            (q.type as any).format === "country",
        );
        if (countryQ) {
          const ans = questionResponses[countryQ.id];
          if (typeof ans === "string" && ans.length === 2) {
            selectedCountryISO2 = ans.toUpperCase();
          }
        }
      } catch {}
      return (
        <TypeFormTransition
          questionId={currentQuestion.id}
          direction={direction}
        >
          <TypeFormQuestion
            question={currentQuestion}
            response={questionResponses[currentQuestion.id] ?? null}
            onAnswer={handleAnswerChange}
            onFileUpload={handleFileUploadWrapper}
            uploadedFile={uploadedFile}
            onFileSelect={setUploadedFile}
            onNext={handleNextWithDirection}
            questionNumber={activeQuestionIndex + 1}
            countryISO2={selectedCountryISO2}
          />
        </TypeFormTransition>
      );
    }

    return null;
  };

  const progress = getProgress(activeQuestionIndex);

  return (
    <FormModeProvider
      defaultMode="typeform"
      formSettings={{ defaultMode: "typeform" }}
      urlSearchParams={{}}
    >
      <TypeFormOverlayProvider>
        {activeQuestionIndex >= 0 && !isCompleted && (
          <TypeFormProgress
            progress={progress}
            current={activeQuestionIndex + 1}
            total={formSchema.questions.length}
          />
        )}
        <TypeFormLayout>
          <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>

          {activeQuestionIndex >= 0 && !isCompleted && (
            <TypeFormNavigation
              onPrevious={handlePrevious}
              onNext={handleNextWithDirection}
              canGoPrevious={activeQuestionIndex > 0}
              canGoNext={isQuestionValid(
                currentQuestion,
                questionResponses[currentQuestion?.id || ""],
              )}
            />
          )}
          <KeyboardShortcutModal
            open={showKeyboardHelp}
            onOpenChange={setShowKeyboardHelp}
          />
        </TypeFormLayout>
      </TypeFormOverlayProvider>
    </FormModeProvider>
  );
}

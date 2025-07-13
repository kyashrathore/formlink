"use client";

import React, { useEffect, useState } from "react";
import { Form, Question } from "@formlink/schema";
import type { UIForm, UIQuestion } from "@formlink/ui";
import { AnimatePresence } from "motion/react";
import { TypeFormDropdownProvider, FormModeProvider } from "@formlink/ui";
import TypeFormLayout from "./TypeFormLayout";
import TypeFormQuestion from "./TypeFormQuestion";
import TypeFormProgress from "./TypeFormProgress";
import TypeFormTransition from "./TypeFormTransition";
import TypeFormNavigation from "./TypeFormNavigation";
import KeyboardShortcutModal from "./KeyboardShortcutModal";
import { IntroScreen, CompletionScreen } from "@formlink/ui";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useTypeFormKeyboard } from "./hooks/useTypeFormKeyboard";
import { useTypeFormScroll } from "./hooks/useTypeFormScroll";
import { useTypeFormSwipe } from "./hooks/useTypeFormSwipe";

interface TypeFormViewProps {
  formSchema: Form;
  uiFormSchema: UIForm;
  formId?: string;
  // Props down: business state
  questions: any[];
  questionResponses: Record<string, any>;
  isCompleted: boolean;
  // Callbacks up: business actions
  onInitialize: (schema: any, id?: string) => Promise<void>;
  onStartQuiz: () => void;
  onRestart: () => Promise<void>;
  onAnswerChange: (
    questionId: string,
    value: any,
    questionType: Question["questionType"],
  ) => void;
  onFileUpload: (questionId: string, file: File) => Promise<string | null>;
  onNavigateNext: (currentIndex: number) => number | null;
  onMarkCompleted: () => void;
  shouldShowQuestion: (question: any) => boolean;
  getCurrentQuestion: (activeIndex: number) => any | null;
  getProgress: (activeIndex: number) => number;
}

export default function TypeFormView({
  formSchema,
  uiFormSchema,
  formId,
  questions,
  questionResponses,
  isCompleted,
  onInitialize,
  onStartQuiz,
  onRestart,
  onAnswerChange,
  onFileUpload,
  onNavigateNext,
  onMarkCompleted,
  shouldShowQuestion,
  getCurrentQuestion,
  getProgress,
}: TypeFormViewProps) {
  const isMobileView = useIsMobile();
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [direction, setDirection] = useState(1);

  // Local UI state (previously from useFormUIStore)
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(-1); // -1 for intro screen
  const [showConfetti, setShowConfetti] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const currentQuestion: Question | null =
    getCurrentQuestion(activeQuestionIndex);

  useEffect(() => {
    if (formSchema) {
      onInitialize(formSchema, formId);
    }
  }, [formSchema, formId]); // Initialize on mount

  useEffect(() => {
    if (activeQuestionIndex < 0 || isCompleted || !currentQuestion) return;
    if (currentQuestion && !shouldShowQuestion(currentQuestion)) {
      handleNavigateToNextValidQuestion();
    }
  }, [
    activeQuestionIndex,
    questionResponses,
    currentQuestion,
    shouldShowQuestion,
    isCompleted,
  ]);

  const handleSelectAndNavigate = (
    questionId: string,
    value: any,
    questionType: Question["questionType"],
  ) => {
    // Call the business logic callback
    onAnswerChange(questionId, value, questionType);

    // Auto-advance for single-selection question types
    const autoAdvanceTypes = [
      "singleChoice",
      "rating",
      "linearScale",
      "likertScale",
    ];
    if (autoAdvanceTypes.includes(questionType)) {
      setTimeout(() => {
        handleNextWithDirection();
      }, 300); // Small delay for visual feedback
    }
  };

  const handlePrevious = () => {
    if (activeQuestionIndex > 0) {
      setDirection(-1); // Going backwards
      // Find previous valid question
      for (let i = activeQuestionIndex - 1; i >= 0; i--) {
        if (shouldShowQuestion(questions[i] as Question)) {
          setActiveQuestionIndex(i);
          break;
        }
      }
    }
  };

  // Track direction for next navigation
  const handleNextWithDirection = () => {
    setDirection(1); // Going forwards
    const nextIndex = onNavigateNext(activeQuestionIndex);
    if (nextIndex !== null) {
      setActiveQuestionIndex(nextIndex);
    } else {
      // No more questions, mark as completed
      onMarkCompleted();
      setShowConfetti(true);
      setActiveQuestionIndex(questions.length);
    }
  };

  const handleNavigateToNextValidQuestion = () => {
    handleNextWithDirection();
  };

  // Setup keyboard navigation
  useTypeFormKeyboard({
    currentQuestion,
    onAnswer: handleSelectAndNavigate,
    onNext: handleNextWithDirection,
    onPrevious: handlePrevious,
    showHelp: () => setShowKeyboardHelp(true),
    getCurrentResponse: (questionId: string) => questionResponses[questionId],
  });

  // Setup scroll navigation (desktop)
  useTypeFormScroll({
    onNext: handleNextWithDirection,
    onPrevious: handlePrevious,
    enabled: !isMobileView && activeQuestionIndex >= 0 && !isCompleted,
  });

  // Setup swipe navigation (mobile)
  useTypeFormSwipe({
    onNext: handleNextWithDirection,
    onPrevious: handlePrevious,
    enabled: isMobileView && activeQuestionIndex >= 0 && !isCompleted,
  });

  const handleStartQuiz = () => {
    onStartQuiz();
    handleNextWithDirection();
  };

  const handleRestart = async () => {
    await onRestart();
    setShowConfetti(false);
    setActiveQuestionIndex(-1);
  };

  const handleFileUploadWrapper = async (questionId: string, file: File) => {
    setIsLoading(true);
    try {
      const url = await onFileUpload(questionId, file);
      if (url) {
        handleNextWithDirection();
      }
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
      return (
        <TypeFormTransition
          questionId={currentQuestion.id}
          direction={direction}
        >
          <TypeFormQuestion
            question={currentQuestion}
            response={questionResponses[currentQuestion.id] ?? null}
            onAnswer={handleSelectAndNavigate}
            onFileUpload={handleFileUploadWrapper}
            uploadedFile={uploadedFile}
            onFileSelect={setUploadedFile}
            onNext={handleNextWithDirection}
            questionNumber={activeQuestionIndex + 1}
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
      <TypeFormDropdownProvider>
        {activeQuestionIndex >= 0 && !isCompleted && (
          <TypeFormProgress
            progress={progress}
            current={activeQuestionIndex + 1}
            total={questions.length}
          />
        )}
        <TypeFormLayout>
          <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>

          {/* Navigation Arrows */}
          {activeQuestionIndex >= 0 && !isCompleted && (
            <TypeFormNavigation
              onPrevious={handlePrevious}
              onNext={handleNextWithDirection}
              canGoPrevious={activeQuestionIndex > 0}
              canGoNext={
                currentQuestion
                  ? currentQuestion.questionType === "text"
                    ? (questionResponses[currentQuestion.id] || "").trim() !==
                      ""
                    : questionResponses[currentQuestion.id] != null
                  : false
              }
            />
          )}

          <KeyboardShortcutModal
            open={showKeyboardHelp}
            onOpenChange={setShowKeyboardHelp}
          />
        </TypeFormLayout>
      </TypeFormDropdownProvider>
    </FormModeProvider>
  );
}

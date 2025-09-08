"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import type { QuestionResponse } from "@/lib/types";
import { Form, getQuestionTypeName, Question } from "@formlink/schema";
import { CompletionScreen, FormModeProvider, IntroScreen } from "@formlink/ui";
import { calcScore } from "@/lib/scoring/calcScore";
import { useResultPage } from "@/hooks/useResultPage";
import ReactMarkdown from "react-markdown";
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
import { useRedirect } from "@/hooks/useRedirect";

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
  // Always compute result page state in a stable hook order
  const resultPage = useResultPage(isCompleted, formSchema, questionResponses);
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);
  const [direction, setDirection] = useState(1);
  const [, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigatingRef = useRef(false);
  const beginNav = () => {
    navigatingRef.current = true;
    setIsNavigating(true);
  };
  const endNav = () => {
    navigatingRef.current = false;
    setIsNavigating(false);
  };

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
    const currentResponse = questionResponses[currentQ?.id || ""] ?? null;
    const valid = isQuestionValid(currentQ, currentResponse);

    setDirection(1); // Going forwards
    // Block navigation only after intro (index >= 0)
    if (activeQuestionIndex >= 0 && !valid) {
      return;
    }

    // Prevent duplicate navigations while in-flight
    if (navigatingRef.current) return;
    beginNav();

    // Check if current question should trigger AI branching
    if (
      currentQ?.mightBranchOffNext &&
      formSchema.settings?.branching?.enabled &&
      formSchema.settings?.journeyScript
    ) {
      const branchingSucceeded = await handleAIBranching(currentQ);
      if (branchingSucceeded) {
        endNav();
        return; // AI handled the navigation
      }
    }

    // Default navigation logic
    const nextIndex = onNavigateNext(activeQuestionIndex);
    if (nextIndex !== null) {
      setActiveQuestionIndex(nextIndex);
      // Add to navigation history for proper backward navigation
      setNavigationHistory((prev) => [...prev, nextIndex]);
      activatedAtRef.current = Date.now();
      endNav();
    } else {
      // No more questions, submit form to API
      const success = await onSubmitForm();
      if (success) {
        setShowConfetti(true);
        setActiveQuestionIndex(formSchema.questions.length);
      } else {
        console.error("Failed to submit form");
      }
      endNav();
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

    setDirection(-1); // Going backwards

    // If history has a valid previous index (not intro), use it
    if (navigationHistory.length > 1) {
      const prevFromHistory = navigationHistory[navigationHistory.length - 2];
      if (typeof prevFromHistory === "number" && prevFromHistory >= 0) {
        const newHistory = [...navigationHistory];
        newHistory.pop();
        setNavigationHistory(newHistory);
        setActiveQuestionIndex(prevFromHistory);
        activatedAtRef.current = Date.now();
        return;
      }
    }

    // Fallback (resume case): walk backwards to the previous visible question
    try {
      const questions = formSchema?.questions || [];
      let i = activeQuestionIndex - 1;
      while (i >= 0) {
        const q = questions[i];
        if (q && shouldShowQuestion(q)) break;
        i--;
      }
      if (i >= 0) {
        setActiveQuestionIndex(i);
        activatedAtRef.current = Date.now();
        // Keep history as-is for resume (so additional back presses continue fallback)
      }
    } catch {
      // noop on failure
    }
  }, [
    activeQuestionIndex,
    navigationHistory,
    formSchema?.questions,
    shouldShowQuestion,
  ]);

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
      (currentQuestion && questionResponses[currentQuestion.id]) ?? null,
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
    // Skip to next unanswered question for resume-friendly start
    try {
      const questions = formSchema?.questions || [];
      const findIsAnswered = (q: Question, resp: QuestionResponse | null) => {
        if (resp === null || typeof resp === "undefined") return false;
        const t = (q.type as any).name as string;
        switch (t) {
          case "text":
            return resp !== "";
          case "multipleChoice":
          case "ranking":
            try {
              if (Array.isArray(resp)) return resp.length > 0;
              if (typeof resp === "string") {
                const arr = JSON.parse(resp);
                return Array.isArray(arr) && arr.length > 0;
              }
              return false;
            } catch {
              return false;
            }
          case "singleChoice":
          case "likertScale":
          case "date":
            return resp !== "";
          case "rating":
          case "linearScale":
            return resp !== null && typeof resp !== "undefined" && resp !== 0;
          case "fileUpload":
            return typeof resp === "string" && resp.length > 0;
          case "address": {
            let obj = resp as any;
            if (typeof obj === "string") {
              try {
                obj = JSON.parse(obj);
              } catch {
                return false;
              }
            }
            if (!obj || typeof obj !== "object") return false;
            const required = [
              "street1",
              "city",
              "stateProvince",
              "postalCode",
              "country",
            ];
            return required.every((k) => Boolean(obj[k]));
          }
          default:
            return resp !== "";
        }
      };

      let targetIndex = -1;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]!;
        const resp = questionResponses[q.id] ?? null;
        if (!findIsAnswered(q, resp)) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex >= 0) {
        setActiveQuestionIndex(targetIndex);
        setNavigationHistory([-1, targetIndex]);
        activatedAtRef.current = Date.now();
      } else {
        // Everything answered, submit immediately
        (async () => {
          const ok = await onSubmitForm();
          if (ok) {
            setShowConfetti(true);
            setActiveQuestionIndex(formSchema.questions.length);
          }
        })();
      }
    } catch {
      // Fallback to normal next
      handleNextWithDirection();
    }
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
      const { total, possible, percentage } = calcScore(
        formSchema,
        questionResponses,
      );
      const hasScore = possible > 0;
      return (
        <CompletionScreen
          isMobileView={isMobileView}
          showConfetti={showConfetti}
          onRestart={handleRestart}
          title={hasScore ? "Quiz Completed!" : undefined}
          message={
            hasScore
              ? "Here is your score summary."
              : "Thank you for completing the form."
          }
        >
          {hasScore && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-3xl font-semibold">
                {total} / {possible}
              </div>
              <div className="text-muted-foreground">
                {percentage.toFixed(0)}%
              </div>
            </div>
          )}
          {resultPage.markdown && (
            <div className="mt-6 text-left max-w-2xl mx-auto prose prose-sm dark:prose-invert">
              <ReactMarkdown>{resultPage.markdown}</ReactMarkdown>
            </div>
          )}
        </CompletionScreen>
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
            isLoadingNext={isNavigating}
          />
        </TypeFormTransition>
      );
    }

    return null;
  };

  const progress = getProgress(activeQuestionIndex);

  // Redirect on submission (Typeform)
  const redirectUrl =
    typeof formSchema?.settings?.redirectOnSubmissionUrl === "string"
      ? (formSchema.settings!.redirectOnSubmissionUrl as string)
      : undefined;
  useRedirect(!!isCompleted, redirectUrl);

  return (
    <FormModeProvider
      defaultMode="typeform"
      formSettings={{ defaultMode: "typeform" }}
      urlSearchParams={{}}
    >
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
            canGoPrevious={activeQuestionIndex > 0 && !isNavigating}
            canGoNext={Boolean(
              currentQuestion &&
                questionResponses[currentQuestion.id] &&
                isQuestionValid(
                  currentQuestion,
                  questionResponses[currentQuestion.id]!,
                ) &&
                !isNavigating,
            )}
            isLoadingNext={isNavigating}
          />
        )}
        <KeyboardShortcutModal
          open={showKeyboardHelp}
          onOpenChange={setShowKeyboardHelp}
        />
      </TypeFormLayout>
    </FormModeProvider>
  );
}

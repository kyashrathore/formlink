"use client";

import { useIsMobile } from "@/hooks/useIsMobile";
import { useResultPage } from "@/hooks/useResultPage";
import { calcScore } from "@/lib/scoring/calcScore";
import type { QuestionResponse } from "@/lib/types";
import type { Form as FormSchema, Question } from "@formlink/schema";
import { Button, Form as UIForm } from "@formlink/ui";
import { CompletionScreen } from "@/components/shared/CompletionScreen";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import ReactMarkdown from "react-markdown";
import { z } from "zod";
import ClassicFormField from "./ClassicFormField";

interface ClassicFormViewProps {
  formSchema: FormSchema;
  formId?: string;
  // Props down: business state
  questionResponses: Record<string, QuestionResponse>;
  isCompleted: boolean;
  // Callbacks up: business actions
  onInitialize: (schema: FormSchema, id?: string) => Promise<void>;
  onStartQuiz: () => void;
  onRestart: () => Promise<void>;
  onAnswerChange: (
    questionId: string,
    value: QuestionResponse,
    questionType: string,
  ) => void;
  onFileUpload: (questionId: string, file: File) => Promise<string | null>;
  onNavigateNext: (currentIndex: number) => number | null;
  onMarkCompleted: () => void;
  onSubmitForm: () => Promise<boolean>;
  shouldShowQuestion: (question: Question) => boolean;
  getCurrentQuestion: (activeIndex: number) => Question | null;
  getProgress: (activeIndex: number) => number;
}

interface ClassicFormState {
  currentPage: number;
  showIntro: boolean;
}

export default function ClassicFormView({
  formSchema,
  formId,
  questionResponses,
  isCompleted,
  onInitialize,
  onStartQuiz,
  onRestart,
  onAnswerChange,
  onFileUpload,
  onSubmitForm,
  shouldShowQuestion,
  getProgress,
}: ClassicFormViewProps) {
  const isMobileView = useIsMobile();
  // Stable hook order: compute result state irrespective of completion
  const result = useResultPage(
    isCompleted,
    formSchema as any,
    questionResponses as any,
  );
  const [showConfetti, setShowConfetti] = useState(false);

  // Classic Mode UI state
  const [formState, setFormState] = useState<ClassicFormState>({
    currentPage: 1,
    // Classic mode: strictly page-based, no progressive/branching
    showIntro: false, // Classic mode doesn't need intro screen
  });

  // Defensive: sanitize questions array to avoid null/invalid entries
  const safeQuestions = useMemo(
    () =>
      Array.isArray(formSchema.questions)
        ? formSchema.questions.filter(
            (q): q is Question =>
              !!q &&
              typeof q === "object" &&
              typeof (q as any).id === "string" &&
              (q as any).type &&
              typeof (q as any).type.name === "string",
          )
        : [],
    [formSchema.questions],
  );

  // Create dynamic Zod schema from form questions
  const formSchema_zod = useMemo(() => {
    const schemaFields: Record<string, z.ZodTypeAny> = {};

    // Classic mode validates based on question type only;
    // visibility is controlled purely by page layout (no progressive reveal).
    for (const question of safeQuestions) {
      const questionId = question.id;

      // Base validation setup based on question type
      switch (question.type.name) {
        case "text":
          // Check if it's a number format text question
          if (question.type.format === "number") {
            schemaFields[questionId] = question.validations?.required?.value
              ? z.union([
                  z.number(),
                  z.string().regex(/^-?\d+(\.\d+)?$/, "Must be a valid number"),
                ])
              : z.union([z.number(), z.string()]).optional();
          } else {
            schemaFields[questionId] = question.validations?.required?.value
              ? z.string().min(1, "This question is required")
              : z.string().optional();
          }
          break;

        case "singleChoice":
          schemaFields[questionId] = question.validations?.required?.value
            ? z.string().min(1, "This question is required")
            : z.string().optional();
          break;

        case "multipleChoice":
          schemaFields[questionId] = question.validations?.required?.value
            ? z.array(z.string()).min(1, "Please select at least one option")
            : z.array(z.string()).optional();
          break;

        case "rating":
        case "linearScale":
          schemaFields[questionId] = question.validations?.required?.value
            ? z.number().min(1, "This question is required")
            : z.number().optional();
          break;

        case "date":
          schemaFields[questionId] = question.validations?.required?.value
            ? z.string().min(1, "This question is required")
            : z.string().optional();
          break;

        case "fileUpload":
          schemaFields[questionId] = question.validations?.required?.value
            ? z
                .union([
                  z.instanceof(File, {
                    message: "Please upload a file",
                  }),
                  z.object({
                    url: z.string(),
                    name: z.string(),
                    size: z.number(),
                  }),
                ])
                .refine((val) => val !== null && val !== undefined, {
                  message: "File is required",
                })
            : z
                .union([
                  z.instanceof(File),
                  z.object({
                    url: z.string(),
                    name: z.string(),
                    size: z.number(),
                  }),
                  z.null(),
                  z.undefined(),
                ])
                .optional();
          break;

        case "address":
          schemaFields[questionId] = question.validations?.required?.value
            ? z
                .object({
                  street1: z.string().optional(),
                  street2: z.string().optional(),
                  city: z.string().optional(),
                  stateProvince: z.string().optional(),
                  postalCode: z.string().optional(),
                  country: z.string().optional(),
                })
                .refine(
                  (addr) =>
                    Object.values(addr).some((val) => val && val.trim() !== ""),
                  "Address is required",
                )
            : z
                .object({
                  street1: z.string().optional(),
                  street2: z.string().optional(),
                  city: z.string().optional(),
                  stateProvince: z.string().optional(),
                  postalCode: z.string().optional(),
                  country: z.string().optional(),
                })
                .optional();
          break;

        default:
          // Fallback for unknown question types
          schemaFields[questionId] = z.any().optional();
      }
    }

    return z.object(schemaFields);
  }, [formSchema.questions]);

  // Initialize react-hook-form
  const form = useForm({
    resolver: zodResolver(formSchema_zod),
    defaultValues: questionResponses,
    mode: "onChange",
  });

  // Keep latest callbacks in refs to avoid effect loops from identity changes
  const initRef = useRef(onInitialize);
  const startRef = useRef(onStartQuiz);
  useEffect(() => {
    initRef.current = onInitialize;
    startRef.current = onStartQuiz;
  }, [onInitialize, onStartQuiz]);

  // Initialize form (Classic mode starts immediately) when form identity changes
  useEffect(() => {
    if (formSchema?.id) {
      initRef.current(formSchema, formId);
      startRef.current();
    }
    // Only depend on identifiers, not callback identities
  }, [formSchema?.id, formId]);

  // Sync form values with business state
  useEffect(() => {
    Object.entries(questionResponses).forEach(([questionId, value]) => {
      form.setValue(questionId, value);
    });
  }, [questionResponses, form]);

  // Get questions for a specific page
  const getQuestionsForPage = useCallback(
    (page: number): Question[] => {
      // Classic mode: show all questions assigned to the page, ignoring conditional logic
      return safeQuestions.filter((q) => {
        const qPage = (q as any).page ?? (q as any).styling?.page ?? 1;
        return qPage === page || (!qPage && page === 1);
      });
    },
    [safeQuestions],
  );

  // Calculate total number of pages
  const totalPages = useMemo(() => {
    const pagesWithQuestions = new Set<number>();
    safeQuestions.forEach((q) => {
      const qPage = (q as any).page ?? (q as any).styling?.page ?? 1;
      pagesWithQuestions.add(qPage || 1);
    });
    return Math.max(...Array.from(pagesWithQuestions), 1);
  }, [safeQuestions]);

  // Get all visible questions (considering progressive reveal)
  const visibleQuestions = useMemo(() => {
    return getQuestionsForPage(formState.currentPage);
  }, [formSchema.questions, formState, getQuestionsForPage]);

  // Handle form submission
  const onSubmit = useCallback(
    async (data: Record<string, any>) => {
      // Save all current responses
      Object.entries(data).forEach(([questionId, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          const question = safeQuestions.find((q) => q.id === questionId);
          if (question) {
            onAnswerChange(questionId, value, question.type.name);
          }
        }
      });

      // Form is complete - submit to API
      const success = await onSubmitForm();
      if (success) {
        setShowConfetti(true);
      } else {
        // submit failed; UI surface handled by upstream
      }
    },
    [
      formSchema,
      onAnswerChange,
      onSubmitForm,
      visibleQuestions,
      shouldShowQuestion,
    ],
  );

  // Handle field changes for progressive reveal
  const handleFieldChange = useCallback(
    (questionId: string, value: QuestionResponse) => {
      const question = safeQuestions.find((q) => q.id === questionId);
      if (question) {
        onAnswerChange(questionId, value, question.type.name);
        form.setValue(questionId, value);
      }
    },
    [formSchema.questions, onAnswerChange, form],
  );

  // Handle page navigation
  const handleNextPage = useCallback(() => {
    if (formState.currentPage < totalPages) {
      const nextPage = formState.currentPage + 1;
      setFormState((prev) => ({
        ...prev,
        currentPage: nextPage,
      }));
    }
  }, [formState.currentPage, totalPages, getQuestionsForPage]);

  const handlePreviousPage = useCallback(() => {
    if (formState.currentPage > 1) {
      setFormState((prev) => ({
        ...prev,
        currentPage: prev.currentPage - 1,
      }));
    }
  }, [formState.currentPage]);

  const handleRestart = async () => {
    await onRestart();
    setShowConfetti(false);
    setFormState({
      currentPage: 1,
      showIntro: false,
    });
    form.reset();
  };

  // Early return if form is not initialized properly
  if (!form || !form.formState) {
    return <div>Loading form...</div>;
  }

  // Render completion screen
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
        {result.markdown && (
          <div className="mt-6 text-left max-w-2xl mx-auto prose prose-sm dark:prose-invert">
            <ReactMarkdown>{result.markdown}</ReactMarkdown>
          </div>
        )}
      </CompletionScreen>
    );
  }

  try {
    return (
      <UIForm {...(form as any)}>
        <div className="classic-form-container max-w-3xl mx-auto p-6">
          {/* Progress Bar */}
          {totalPages > 1 && (
            <div className="mb-8">
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                  style={{
                    width: `${Math.max(5, (formState.currentPage / totalPages) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Form Title and Description */}
          <div className="mb-8">
            {formSchema.title && (
              <h1 className="text-3xl font-bold mb-3">{formSchema.title}</h1>
            )}
            {formSchema.description && (
              <p className="text-lg text-muted-foreground max-w-[70ch]">
                {formSchema.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <AnimatePresence mode="wait">
              {visibleQuestions.map((question) => {
                // Default to full width (12 columns) if no colSpan specified
                const colSpan =
                  (question as any).styling?.colSpan ??
                  (question as any).colSpan ??
                  (question as any).colspan ??
                  12;
                // On mobile, all questions take full width
                const colSpanClass = isMobileView
                  ? "col-span-1"
                  : colSpan === 1
                    ? "md:col-span-1"
                    : colSpan === 2
                      ? "md:col-span-2"
                      : colSpan === 3
                        ? "md:col-span-3"
                        : colSpan === 4
                          ? "md:col-span-4"
                          : colSpan === 5
                            ? "md:col-span-5"
                            : colSpan === 6
                              ? "md:col-span-6"
                              : colSpan === 7
                                ? "md:col-span-7"
                                : colSpan === 8
                                  ? "md:col-span-8"
                                  : colSpan === 9
                                    ? "md:col-span-9"
                                    : colSpan === 10
                                      ? "md:col-span-10"
                                      : colSpan === 11
                                        ? "md:col-span-11"
                                        : "md:col-span-12";

                return (
                  <motion.div
                    key={question.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className={colSpanClass}
                  >
                    <ClassicFormField
                      question={question}
                      value={questionResponses[question.id] ?? null}
                      onChange={(value) =>
                        handleFieldChange(question.id, value)
                      }
                      onFileUpload={(file) => onFileUpload(question.id, file)}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Navigation and Submit Buttons */}
          <div className="mt-8 flex justify-between items-center">
            <div className="flex gap-2">
              {formState.currentPage > 1 && (
                <Button
                  type="button"
                  onClick={handlePreviousPage}
                  variant="outline"
                  size="lg"
                >
                  Previous
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {formState.currentPage < totalPages ? (
                <Button
                  type="button"
                  onClick={async () => {
                    // Validate only current page fields before moving forward
                    const ok = await form.trigger(
                      visibleQuestions.map((q) => q.id as any) as any,
                      { shouldFocus: true } as any,
                    );
                    if (ok) handleNextPage();
                  }}
                  size="lg"
                  className="min-w-32"
                >
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={
                    !form.formState.isValid || form.formState.isSubmitting
                  }
                  size="lg"
                  className="min-w-32"
                >
                  Submit
                </Button>
              )}
            </div>
          </div>
        </div>
      </UIForm>
    );
  } catch (error) {
    return <div>Error loading classic form: {String(error)}</div>;
  }
}

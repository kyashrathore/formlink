/**
 * Example: Job Application (SDE2 @ Stripe)
 * Purpose: A complete, production-quality Typeform-like flow demonstrating the full user lifecycle.
 * API/props: Exports `JobApplicationSDE2StripeExample`.
 * State: Uses the headless runtime's status machine (`context.status`) to show intro, filling, and completion states.
 * Niceties: Composes layout components, includes animations, loading states, and keyboard hints.
 */

import React, { useCallback } from "react";
import { createRuntime, fetchTransport, tf } from "@formlink/runtime";
import { UnifiedDropdownSelect, UnifiedFileUpload } from "@formlink/ui";
import { TypeFormTextInput } from "@formlink/ui/form/modes/typeform/TypeFormTextInput";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Loader } from "lucide-react";

// --- Mock UI Components (These would live in @formlink/ui) ---
const TypeFormLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gray-50 text-gray-800 font-sans">
    {children}
  </div>
);
const IntroScreen = ({ title, description, onStart }: any) => (
  <motion.div {...tf.stepEnter(0)} className="text-center max-w-2xl">
    <h1 className="text-4xl font-bold mb-4 text-gray-900">{title}</h1>
    <p className="text-xl text-gray-600 mb-8">{description}</p>
    <button
      className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold text-lg hover:bg-indigo-700 transition-colors"
      onClick={onStart}
    >
      Start Application →
    </button>
  </motion.div>
);
const CompletionScreen = () => (
  <motion.div {...tf.stepEnter(0)} className="text-center max-w-2xl">
    <h1 className="text-4xl font-bold mb-4 text-gray-900">Thank You!</h1>
    <p className="text-xl text-gray-600">
      Your application has been submitted successfully.
    </p>
  </motion.div>
);
const TypeFormQuestionHeader = ({ question, questionNumber }: any) => (
  <div className="mb-8 text-left">
    <div className="flex items-center text-indigo-600 font-semibold text-lg mb-2">
      <span>{questionNumber}</span>
      <ArrowRight className="w-5 h-5 ml-2" />
    </div>
    <h2 className="text-3xl font-bold text-gray-900">
      {question.label}
      {question.required && <span className="text-red-500 ml-1">*</span>}
    </h2>
    {question.description && (
      <p className="text-gray-500 mt-2 text-lg">{question.description}</p>
    )}
  </div>
);
const TypeFormContinueFooter = ({
  onClick,
  isLoading,
  isValid,
  errorMessage,
}: any) => (
  <div className="pt-8 mt-6 w-full">
    <div className="flex items-center gap-4">
      <button
        className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors flex items-center"
        onClick={onClick}
        disabled={!isValid || isLoading}
      >
        {isLoading ? (
          <>
            <Loader className="animate-spin mr-2" size={20} />
            <span>Saving...</span>
          </>
        ) : (
          "OK"
        )}
      </button>
      <span className="text-sm text-gray-500">
        Press <strong>Enter</strong>
      </span>
    </div>
    {errorMessage && (
      <motion.div {...tf.errorShake()} className="mt-4 text-sm text-red-600">
        {errorMessage}
      </motion.div>
    )}
  </div>
);
const StepTransition = ({ children, key }: any) => (
  <AnimatePresence mode="wait">
    <motion.div key={key} {...tf.stepEnter(0)} className="w-full max-w-2xl">
      {children}
    </motion.div>
  </AnimatePresence>
);

// --- Schema ---
const form: any = {
  id: "stripe_sde2_app",
  title: "Stripe — SDE2 Application",
  description:
    "Thanks for your interest in Stripe. Please fill out the application below.",
  questions: [
    {
      id: "q1_full_name",
      kind: "text",
      label: "Your full name",
      required: true,
      description: "Please enter your full legal name.",
    },
    {
      id: "q2_email",
      kind: "text",
      subtype: "email",
      label: "Work email",
      required: true,
    },
    {
      id: "q3_linkedin",
      kind: "text",
      subtype: "url",
      label: "LinkedIn profile",
    },
    { id: "q4_resume", kind: "fileUpload", label: "Upload your resume (PDF)" },
    {
      id: "q5_yoe",
      kind: "number",
      label: "Total years of professional experience",
      min: 0,
      max: 40,
    },
    {
      id: "q6_role_fit",
      kind: "singleChoice",
      label: "Which role level best fits your experience?",
      options: [
        { value: "SDE1", label: "SDE 1" },
        { value: "SDE2", label: "SDE 2" },
        { value: "Senior", label: "Senior Engineer" },
      ],
      required: true,
      default: "SDE2",
    },
  ],
};

// --- Runtime ---
const rt = createRuntime({
  form,
  transport: fetchTransport({ baseUrl: "/api" }),
});

// --- Main Component ---

function QuestionScreen() {
  const { context, actions } = rt;
  const qId = context.currentId;
  const q = context.get.q(qId);

  const onFileUpload = useCallback(
    async (qid: string, file: File) => {
      const desc = await actions.upload(qid, file);
      actions.set(qid, desc);
    },
    [actions],
  );

  if (!q) return null;

  const isSubmitting = context.status === "submitting";
  const isValid = actions.validate(qId).isValid;

  return (
    <StepTransition key={qId}>
      <TypeFormQuestionHeader
        question={q}
        questionNumber={context.progress.index + 1}
      />

      {/* RENDER THE CORRECT INPUT COMPONENT */}
      <div className="min-h-[120px]">
        {q.kind === "text" && (
          <TypeFormTextInput
            value={String(context.get.value(qId) ?? "")}
            onChange={(v) => actions.set(qId, v)}
            onSubmit={() => !isSubmitting && isValid && actions.next()}
            type={q.subtype ?? (q.id === "q5_yoe" ? "number" : "text")}
            isInvalid={!isValid}
            disabled={isSubmitting}
          />
        )}
        {q.kind === "fileUpload" && (
          <UnifiedFileUpload
            mode="typeform"
            questionId={qId}
            onFileUpload={onFileUpload}
            onSubmit={() => !isSubmitting && actions.next()}
            disabled={isSubmitting}
          />
        )}
        {q.kind === "singleChoice" && (
          <UnifiedDropdownSelect
            mode="typeform"
            value={context.get.value(qId) || q.default || ""}
            onChange={(v) => actions.set(qId, v)}
            onSubmit={() => !isSubmitting && actions.next()}
            options={q.options}
            disabled={isSubmitting}
          />
        )}
      </div>

      <TypeFormContinueFooter
        onClick={() => !isSubmitting && isValid && actions.next()}
        isLoading={isSubmitting}
        isValid={isValid}
        errorMessage={context.get.error(qId)}
      />

      <div className="absolute left-4 bottom-4">
        <button
          className="px-4 py-2 border rounded-md font-semibold hover:bg-gray-100 transition-colors disabled:opacity-50"
          onClick={() => actions.prev()}
          disabled={isSubmitting}
        >
          Back
        </button>
      </div>
    </StepTransition>
  );
}

export function JobApplicationSDE2StripeExample() {
  const { context, actions } = rt;

  const renderContent = () => {
    switch (context.status) {
      case "idle":
        return (
          <IntroScreen
            title={form.title}
            description={form.description}
            onStart={actions.start}
          />
        );
      case "completed":
        return <CompletionScreen />;
      case "filling":
      case "submitting":
        return <QuestionScreen />;
      case "error":
        return <div>Error submitting form. Please try again.</div>;
      default:
        return <div>Loading...</div>;
    }
  };

  return (
    <TypeFormLayout>
      {renderContent()}
      {context.unansweredIds.length === 0 && context.status === "filling" && (
        <div className="absolute bottom-10">
          <button
            className="px-8 py-3 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-green-700 transition-colors"
            onClick={() => actions.submit()}
            disabled={context.status === "submitting"}
          >
            {context.status === "submitting"
              ? "Submitting..."
              : "Submit Application"}
          </button>
        </div>
      )}
    </TypeFormLayout>
  );
}

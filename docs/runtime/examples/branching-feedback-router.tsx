/**
 * Example: Branching Router (Feedback / Review / Bug / Feature)
 * Purpose: Classic page rendering all runtime-visible questions with follow-ups per choice.
 * API/props: Exports `FeedbackRouterClassicExample` with no props.
 * State: Headless runtime `context`/`actions` are the single source of truth.
 * Edge cases: Visibility is runtime-owned; UI must not compute rules.
 * Verification: Toggle primary choice and observe visible follow-ups update; submit when valid.
 */

import React from "react";
import { Input } from "@formlink/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@formlink/ui/select";
import { createRuntime, fetchTransport } from "@formlink/runtime";

const form: any = {
  id: "feedback_router",
  title: "Share your thoughts",
  settings: {
    branching: {
      enabled: true,
    },
    journeyScript: `
<form-journey>
  <strategy>
    ## Purpose
    To triage user feedback into different categories for proper handling.
  </strategy>
  <branching-logic>
    ## Conditional Paths
    - If user selects "Feedback" for "What would you like to share?", then show the "Describe your feedback" question.
    - If user selects "Review", then show the "Rate the product" question.
    - If user selects "Bug report", then show the "What broke?" question.
    - If user selects "Feature request", then show the "What feature do you need?" question.
  </branching-logic>
  <result-generation>
    ## Purpose
    Confirm submission and thank the user for their input.
  </result-generation>
</form-journey>
    `,
  },
  questions: [
    {
      id: "q1_topic",
      kind: "singleChoice",
      label: "What would you like to share?",
      options: [
        { value: "feedback", label: "Feedback" },
        { value: "review", label: "Review" },
        { value: "bug", label: "Bug report" },
        { value: "feature", label: "Feature request" },
      ],
      required: true,
    },
    { id: "q2_feedback", kind: "text", label: "Describe your feedback" },
    {
      id: "q2_review",
      kind: "rating",
      label: "Rate the product (1–5)",
      config: { max: 5 },
    },
    { id: "q2_bug", kind: "text", label: "What broke? Steps to reproduce?" },
    { id: "q2_feature", kind: "text", label: "What feature do you need?" },
  ],
};

import { AnimatePresence, motion } from "motion/react";

const rt = createRuntime({
  form,
  transport: fetchTransport({ baseUrl: "/api" }),
});

export function FeedbackRouterClassicExample() {
  const { context, actions } = rt;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actions.validateAll().isValid) {
      actions.submit();
    }
  };

  const isSubmitting = context.status === "submitting";

  return (
    <form className="max-w-xl mx-auto space-y-6" onSubmit={handleSubmit}>
      <h1 className="text-2xl font-semibold mb-4">{form.title}</h1>

      <AnimatePresence initial={false}>
        {context.visibleIds.map((id) => {
          const q = context.get.q(id);
          if (!q) return null;

          const error = actions.validate(id).errors[0];

          return (
            <motion.div
              key={id}
              initial={{ opacity: 0, y: 20, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -20, height: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-2 overflow-hidden"
            >
              <label htmlFor={id} className="font-medium">
                {q.label}
              </label>
              {q.kind === "singleChoice" ? (
                <Select
                  value={String(context.get.value(id) ?? "")}
                  onValueChange={(v) => actions.set(id, v)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger id={id}>
                    <SelectValue placeholder="Select an option" />
                  </SelectTrigger>
                  <SelectContent>
                    {(q.options || []).map((o: any) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={id}
                  value={String(context.get.value(id) ?? "")}
                  onChange={(e) => actions.set(id, e.target.value)}
                  disabled={isSubmitting}
                />
              )}
              {error && (
                <p className="text-sm text-red-600 mt-1">{error.message}</p>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <div className="pt-4">
        <button
          type="submit"
          className="px-6 py-2 bg-black text-white rounded-md disabled:opacity-50 transition-opacity"
          disabled={!actions.validateAll().isValid || isSubmitting}
        >
          {isSubmitting ? "Submitting..." : "Send"}
        </button>
      </div>
    </form>
  );
}

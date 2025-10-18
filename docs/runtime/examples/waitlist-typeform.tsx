/**
 * Example: Typeform-like Waitlist Form (Website)
 * Purpose: One-by-one flow with simple fields; auto-advance on valid.
 * API/props: Exports React component `WaitlistTypeformExample` with no props.
 * State: Headless runtime `context`/`actions` only.
 * Edge cases: Email format, required fields; block `next()` when invalid.
 * Verification: Mount; ensure each step validates and advances; submit at end.
 */

import React from "react";
import { createRuntime, fetchTransport } from "@formlink/runtime";
import { TypeFormTextInput } from "@formlink/ui/form/modes/typeform/TypeFormTextInput";

const form: any = {
  id: "waitlist_site",
  title: "Join the Waitlist",
  questions: [
    {
      id: "q1_email",
      kind: "text",
      subtype: "email",
      label: "Work email",
      required: true,
    },
    { id: "q2_company", kind: "text", label: "Company", required: true },
    { id: "q3_role", kind: "text", label: "Your role" },
    {
      id: "q4_team_size",
      kind: "number",
      label: "Team size",
      min: 1,
      max: 10000,
    },
  ],
};

const rt = createRuntime({
  form,
  transport: fetchTransport({ baseUrl: "/api" }),
});

export function WaitlistTypeformExample() {
  const { context, actions } = rt;
  const qId = context.currentId ?? context.firstUnansweredId;
  const q = context.get.q(qId);
  if (!q) return null;

  const value = String(context.get.value(qId) ?? "");
  const valid = actions.validate(qId).isValid;

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-semibold">{form.title}</h1>
      <TypeFormTextInput
        value={value}
        onChange={(v) => actions.set(qId, v)}
        onSubmit={() => valid && actions.next()}
        type={
          q.subtype === "email"
            ? "email"
            : q.kind === "number"
              ? "number"
              : "text"
        }
        isInvalid={!valid}
      />

      <div className="flex items-center justify-end">
        <button
          className="px-3 py-2 bg-black text-white rounded disabled:opacity-50"
          disabled={!valid}
          onClick={() => actions.next()}
        >
          Continue
        </button>
      </div>

      {context.unansweredIds.length === 0 && (
        <div className="pt-2">
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded"
            onClick={() => actions.submit()}
          >
            Join Waitlist
          </button>
        </div>
      )}
    </div>
  );
}

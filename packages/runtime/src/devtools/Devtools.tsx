"use client";
import React from "react";
import type { Question } from "../schema";
import type { RuntimeApi, RuntimeContextSnapshot } from "../types";

type DevEvent = {
  ts: number;
  type: string;
  payload?: unknown;
};

function useDevlog(runtime: RuntimeApi) {
  const [events, setEvents] = React.useState<DevEvent[]>([]);
  React.useEffect(() => {
    const add = (type: string) => (payload: unknown) =>
      setEvents((prev: DevEvent[]) => [
        ...prev,
        { ts: Date.now(), type, payload },
      ]);
    const unsubs = [
      runtime.events.on("status:change", add("status:change")),
      runtime.events.on("answer:set", add("answer:set")),
      runtime.events.on("visibility:change", add("visibility:change")),
      runtime.events.on("progress:change", add("progress:change")),
      runtime.events.on("submit:success", add("submit:success")),
      runtime.events.on("submit:error", add("submit:error")),
      runtime.events.on("upload:success", add("upload:success")),
      runtime.events.on("upload:error", add("upload:error")),
    ];
    return () => unsubs.forEach((off) => off());
  }, [runtime]);
  const clear = React.useCallback(() => setEvents([]), []);
  const copy = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(events, null, 2));
    } catch {}
  }, [events]);
  return { events, clear, copy };
}

function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function DevtoolsPanel({ runtime }: { runtime: RuntimeApi }) {
  const subscribe = React.useCallback(
    (fn: () => void) => runtime.context.subscribe(fn),
    [runtime],
  );
  const getSnapshot = React.useCallback<() => RuntimeContextSnapshot>(
    () => runtime.context.getSnapshot(),
    [runtime],
  );
  const snapshot = React.useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
  const { events, clear, copy } = useDevlog(runtime);

  const form = runtime.context.form;
  const questions = React.useMemo(() => {
    const visibleErrorGetter = runtime.context.get.visibleError ?? null;
    // Filter out non-persisted UI-only questions (element nodes expressed via styling.as)
    const FIELD_ONLY = (form.questions as Question[]).filter(
      (q: any) => !q?.styling?.as,
    );
    return FIELD_ONLY.map((question) => {
      const value = snapshot.values[question.id];
      const answeredState = isAnswered(value);
      const rawErrors = snapshot.errors[question.id] ?? [];
      const visibleError =
        typeof visibleErrorGetter === "function"
          ? visibleErrorGetter(question.id)
          : undefined;
      const hasVisibleError =
        typeof visibleError === "string" && visibleError.length > 0;
      const pendingError = rawErrors.length > 0;
      return {
        question,
        answered: answeredState,
        visibleError,
        hasVisibleError,
        pendingError,
        value,
      };
    });
  }, [form.questions, runtime.context, snapshot.errors, snapshot.values]);

  const firstErrorId = React.useMemo(() => {
    const firstVisible = questions.find((item) => item.hasVisibleError);
    if (firstVisible) return firstVisible.question.id;
    if (snapshot.firstUnansweredId) return snapshot.firstUnansweredId;
    const firstPending = questions.find((item) => !item.answered);
    return firstPending?.question.id ?? null;
  }, [questions, snapshot.firstUnansweredId]);

  const tagForQuestion = (q: Question) => {
    const tags: string[] = [];
    const isRequired = q.validations?.required?.value === true;
    tags.push(isRequired ? "required" : "optional");
    // type-specific tags
    const questionType = q.type;
    if (questionType?.name === "text" && "format" in questionType) {
      tags.push(String(questionType.format));
    }
    const validations = q.validations;
    if (validations?.minLength)
      tags.push(`minLen:${validations.minLength.value}`);
    if (validations?.maxLength)
      tags.push(`maxLen:${validations.maxLength.value}`);
    if (validations?.pattern) tags.push("pattern");
    return tags;
  };

  const currentQuestion = snapshot.currentId
    ? runtime.context.get.q(snapshot.currentId)
    : undefined;

  const handleNavigate = React.useCallback(
    (questionId: string) => {
      // Typeform mode (or when currentId is used): use goTo
      try {
        if (snapshot.currentId !== questionId) {
          runtime.actions.goTo(questionId);
        }
      } catch (error) {
        // non-fatal in classic; we fall back to DOM focus
      }

      // Classic mode: attempt to focus DOM field by data attribute
      try {
        const win: any = typeof window !== "undefined" ? window : null;
        if (!win || !win.document) return;
        const el = win.document.querySelector(
          `[data-fl-qid="${CSS.escape(questionId)}"]`,
        ) as HTMLElement | null;
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          // Find a focusable descendant
          const focusable = el.querySelector(
            'input, textarea, select, [contenteditable="true"], [tabindex]:not([tabindex="-1"])',
          ) as HTMLElement | null;
          if (focusable) {
            // Delay focus slightly to allow scroll
            setTimeout(() => {
              try {
                focusable.focus({ preventScroll: true } as any);
              } catch {}
            }, 75);
          }
          return;
        }
        // If not found, emit a custom event so hosts can switch steps and re-render nodes
        try {
          const evt = new CustomEvent("formlink:devtools:goto", {
            detail: { questionId },
          });
          win.dispatchEvent(evt);
        } catch {}
      } catch {}
    },
    [runtime.actions, snapshot.currentId],
  );

  return (
    <div className="w-full max-w-md pr-6 rounded-lg border bg-card p-4 shadow-sm h-full overflow-y-auto min-h-0">
      {/* Header row: status + current question */}
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground">Status</div>
          <div className="text-sm font-semibold">{snapshot.status}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Current question</div>
          <div className="text-sm font-medium">
            {currentQuestion?.title ?? snapshot.currentId ?? "(none)"}
          </div>
        </div>
      </div>

      {/* Answered */}
      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">Questions</div>
        <div className="space-y-4">
          {questions.map(
            ({
              question,
              answered,
              visibleError,
              hasVisibleError,
              pendingError,
              value,
            }) => {
              const isCurrent = snapshot.currentId === question.id;
              const showWarning =
                !answered && firstErrorId === question.id && !visibleError;
              const banner =
                visibleError ??
                (showWarning ? "Fix this before submitting." : null);
              return (
                <div
                  key={question.id}
                  className={["relative", banner ? "pt-12" : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {banner && (
                    <>
                      <div className="h-6" aria-hidden="true" />
                      <div
                        style={{ width: "95%" }}
                        className="absolute z-10 inset-x-0 -top-6  mx-auto flex justify-center bg-background"
                      >
                        <div className="w-full rounded-md border border-destructive bg-destructive/95 px-3 py-1.5 text-xs font-medium text-destructive-foreground shadow-md">
                          {banner}
                        </div>
                      </div>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNavigate(question.id)}
                    className={[
                      "w-full rounded-md border p-2 text-left transition-colors",
                      answered
                        ? "border-emerald-300/70 bg-emerald-50/30 dark:bg-emerald-950/10"
                        : "border-border bg-card",
                      isCurrent ? "ring-2 ring-primary border-primary" : "",
                      hasVisibleError
                        ? "border-destructive/70 bg-destructive/10"
                        : "",
                      showWarning ? "border-amber-200 bg-amber-50/40" : "",
                      pendingError && !answered
                        ? "border-amber-100 bg-amber-50/30"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{question.title}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {question.id}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-xs">
                      {answered ? (
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                          Answered
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-2 py-0.5 text-muted-foreground">
                          Pending
                        </span>
                      )}
                      {tagForQuestion(question).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-muted px-2 py-0.5 text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    {answered && (
                      <div className="mt-2 font-mono text-xs break-all text-muted-foreground">
                        {JSON.stringify(value)}
                      </div>
                    )}
                  </button>
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* Events */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold">Events ({events.length})</div>
          <div className="flex items-center gap-2">
            <button className="rounded border px-2 py-1 text-xs" onClick={copy}>
              Copy
            </button>
            <button
              className="rounded border px-2 py-1 text-xs"
              onClick={clear}
            >
              Clear
            </button>
          </div>
        </div>
        <CollapsibleEvents events={events} />
      </div>
    </div>
  );
}

function CollapsibleEvents({ events }: { events: DevEvent[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded border">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b">
        <div className="text-xs text-muted-foreground">
          {open ? "Hide" : "Show"} event log
        </div>
        <button
          type="button"
          className="inline-flex h-7 items-center rounded px-2 text-xs hover:bg-muted"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      {open && (
        <div className="max-h-64 max-w-full overflow-auto">
          <table className="w-full table-fixed text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-2 py-1 w-24">Time</th>
                <th className="px-2 py-1 w-40">Type</th>
                <th className="px-2 py-1">Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-2 py-1 font-mono text-xs align-top">
                    {new Date(e.ts).toLocaleTimeString()}
                  </td>
                  <td className="px-2 py-1 align-top">{e.type}</td>
                  <td
                    className="px-2 py-1 font-mono text-xs whitespace-pre-wrap break-words align-top"
                    title={
                      typeof e.payload === "string"
                        ? e.payload
                        : JSON.stringify(e.payload)
                    }
                  >
                    {typeof e.payload === "string"
                      ? e.payload
                      : JSON.stringify(e.payload)}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td
                    colSpan={3}
                    className="px-2 py-3 text-center text-muted-foreground"
                  >
                    No events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type DevtoolsProps = {
  runtime: RuntimeApi;
  label: string;
};

export function Devtools({ runtime, label = "Devtools" }: DevtoolsProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label={open ? "Hide Devtools" : "Show Devtools"}
          onClick={() => setOpen((v) => !v)}
          title={label}
          style={{
            position: "fixed",
            left: 16,
            bottom: 16,
            width: 40,
            height: 40,
            borderRadius: 9999,
            background:
              "linear-gradient(135deg, var(--color-primary, #3b82f6), rgba(59,130,246,0.85))",
            color: "#fff",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow:
              "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
            zIndex: 2147483647,
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            style={{ width: 20, height: 20 }}
            fill="currentColor"
          >
            <path d="M22.7 19.3l-6.4-6.4a7 7 0 11-3.5-3.5l6.4 6.4a2.5 2.5 0 103.5 3.5zM9 14a5 5 0 100-10 5 5 0 000 10z" />
          </svg>
          <span className="sr-only">{label}</span>
        </button>
      )}

      {open && (
        <div>
          <div>
            <div className="flex items-center justify-between border-b bg-card/60 px-3 py-2">
              <div className="text-xs font-medium text-muted-foreground">
                Runtime Devtools
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-7 items-center rounded px-2 text-xs hover:bg-muted"
                  onClick={() => setOpen(false)}
                >
                  Collapse
                </button>
              </div>
            </div>
            <div className="p-3 flex-1 min-h-0 overflow-y-auto">
              <DevtoolsPanel runtime={runtime} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

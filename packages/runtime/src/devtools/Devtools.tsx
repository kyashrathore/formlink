"use client";
import React from "react";
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
  const answered = form.questions.filter((q: any) =>
    isAnswered(snapshot.values[q.id]),
  );
  const unanswered = form.questions.filter(
    (q: any) => !isAnswered(snapshot.values[q.id]),
  );

  const tagForQuestion = (q: (typeof form.questions)[number]) => {
    const tags: string[] = [];
    if ((q as any)?.validations?.required?.value) tags.push("required");
    else tags.push("optional");
    // type-specific tags
    const t: any = q.type;
    if (t?.name === "text" && t?.format) tags.push(String(t.format));
    const v: any = (q as any)?.validations ?? {};
    if (v.minLength) tags.push(`minLen:${v.minLength.value}`);
    if (v.maxLength) tags.push(`maxLen:${v.maxLength.value}`);
    if ((q as any)?.validations?.pattern) tags.push("pattern");
    return tags;
  };

  const currentQuestion = snapshot.currentId
    ? runtime.context.get.q(snapshot.currentId)
    : undefined;

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
        <div className="mb-2 text-sm font-semibold">
          Answered ({answered.length})
        </div>
        <div className="space-y-2">
          {answered.map((q: any) => (
            <div key={q.id} className="rounded-md border p-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{q.title}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {q.id}
                </div>
              </div>
              <div className="mt-1 font-mono text-xs break-all">
                {JSON.stringify(snapshot.values[q.id])}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {tagForQuestion(q).map((t) => (
                  <span
                    key={t}
                    className="rounded bg-muted px-2 py-0.5 text-xs"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {answered.length === 0 && (
            <div className="text-sm text-muted-foreground">No answers yet.</div>
          )}
        </div>
      </div>

      {/* Unanswered */}
      <div className="mt-6">
        <div className="mb-2 text-sm font-semibold">
          Unanswered ({unanswered.length})
        </div>
        <div className="space-y-2">
          {unanswered.map((q: any) => (
            <div key={q.id} className="rounded-md border p-2">
              <div className="flex items-center justify-between">
                <div className="font-medium">{q.title}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {q.id}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {tagForQuestion(q).map((t) => (
                  <span
                    key={t}
                    className="rounded bg-muted px-2 py-0.5 text-xs"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {unanswered.length === 0 && (
            <div className="text-sm text-muted-foreground">All answered.</div>
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
        <div className="max-h-64 overflow-auto rounded border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-2 py-1">Time</th>
                <th className="px-2 py-1">Type</th>
                <th className="px-2 py-1">Payload</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-2 py-1 font-mono text-xs">
                    {new Date(e.ts).toLocaleTimeString()}
                  </td>
                  <td className="px-2 py-1">{e.type}</td>
                  <td
                    className="px-2 py-1 font-mono text-xs whitespace-nowrap overflow-hidden text-ellipsis"
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
      </div>
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

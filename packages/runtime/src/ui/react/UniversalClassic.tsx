"use client";
import * as React from "react";
import { useSyncExternalStore } from "react";
import type { Question } from "../../schema";
import { useRuntime } from "./runtime-context";
import { useUiComponents } from "./primitives/context";
import { UnifiedPhoneInput } from "./UnifiedPhoneInput";
import { UnifiedFileUpload } from "./UnifiedFileUpload";
import { UnifiedDatePicker } from "./UnifiedDatePicker";

type ShowIf = {
  q: string;
  equals?: string | string[];
  in?: string[];
  not?: string | string[];
};

function evalShowIf(si: ShowIf, getValue: (qId: string) => unknown): boolean {
  const val = getValue(si.q);
  const s = (x: unknown) => (x == null ? "" : String(x));
  const valStr = s(val);
  if (si.equals !== undefined) {
    if (Array.isArray(si.equals)) {
      if (!si.equals.map(s).includes(valStr)) return false;
    } else {
      if (valStr !== s(si.equals)) return false;
    }
  }
  if (si.in) {
    if (!si.in.map(s).includes(valStr)) return false;
  }
  if (si.not !== undefined) {
    if (Array.isArray(si.not)) {
      if (si.not.map(s).includes(valStr)) return false;
    } else {
      if (valStr === s(si.not)) return false;
    }
  }
  return true;
}

function formatWithRefs(
  text: string,
  getValue: (qId: string) => unknown,
): string {
  return text.replace(/\{\{(.*?)\}\}/g, (_m, id) => {
    const val = getValue(String(id).trim());
    return val == null ? "" : String(val);
  });
}

export function UniversalClassic({
  nodes: propNodes,
  showDefaultSubmit = true,
}: {
  nodes?: any[];
  showDefaultSubmit?: boolean;
}): React.JSX.Element | null {
  const runtime = useRuntime();
  const primitives = useUiComponents();
  const Btn =
    (primitives.Button as React.ElementType | undefined) ?? ("button" as any);
  const Input =
    (primitives.Input as React.ElementType | undefined) ?? ("input" as any);
  const Textarea =
    (primitives.Textarea as React.ElementType | undefined) ??
    ("textarea" as any);
  const Label =
    (primitives.Label as React.ElementType | undefined) ?? ("label" as any);
  const Separator =
    (primitives.Separator as React.ElementType | undefined) ?? ("hr" as any);

  if (!runtime) return null;

  const subscribe = React.useCallback(
    (fn: () => void) => runtime.context.subscribe(fn),
    [runtime],
  );
  const getSnapshot = React.useCallback(
    () => runtime.context.getSnapshot(),
    [runtime],
  );
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const SPAN_MD: Record<number, string> = {
    1: "md:col-span-1",
    2: "md:col-span-2",
    3: "md:col-span-3",
    4: "md:col-span-4",
    5: "md:col-span-5",
    6: "md:col-span-6",
    7: "md:col-span-7",
    8: "md:col-span-8",
    9: "md:col-span-9",
    10: "md:col-span-10",
    11: "md:col-span-11",
    12: "md:col-span-12",
  };

  const formAny = runtime.context.form as any;
  const questions = runtime.context.form.questions as Question[];

  const nodes = Array.isArray(propNodes)
    ? propNodes
    : Array.isArray(formAny?.layout?.body)
      ? (formAny.layout.body as any[])
      : questions.filter((q) => {
          const showIf = (q as any)?.styling?.showIf as ShowIf | undefined;
          if (showIf)
            return evalShowIf(showIf, (id) => runtime.context.get.value(id));
          return true;
        });

  const renderBlock = (q: Question | any): React.ReactNode => {
    // Support custom element node renderer: kind:'element', node:(schema)=>ReactNode
    const nodeFn = (q as any)?.node as
      | undefined
      | ((schema: any) => React.ReactNode);
    if (typeof nodeFn === "function") {
      try {
        return nodeFn(q);
      } catch (_) {
        // fall through to default role handling
      }
    }

    const as = (q as any)?.styling?.as as
      | "heading"
      | "subheading"
      | "separator"
      | "oauth"
      | "legal"
      | "spacer"
      | "info"
      | undefined;
    if (!as) return null;
    const title = q.title ?? "";
    const desc = q.description ?? "";
    if (as === "heading")
      return <h3 className="text-xl font-semibold">{title}</h3>;
    if (as === "subheading")
      return <p className="text-sm text-muted-foreground">{desc || title}</p>;
    if (as === "separator")
      return (
        <div className="flex items-center gap-3 my-2">
          <Separator className="flex-1" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {title || "or"}
          </span>
          <Separator className="flex-1" />
        </div>
      );
    if (as === "oauth")
      return (
        <div className="flex flex-col sm:flex-row gap-3">
          <Btn className="border px-3 py-2 rounded-md" type="button">
            Continue with Google
          </Btn>
          <Btn className="border px-3 py-2 rounded-md" type="button">
            Continue with GitHub
          </Btn>
        </div>
      );
    if (as === "legal")
      return <p className="text-xs text-muted-foreground">{desc || title}</p>;
    if (as === "spacer") return <div className="h-4" />;
    if (as === "info")
      return (
        <div className="text-sm text-muted-foreground">{desc || title}</div>
      );
    return null;
  };

  const renderField = (q: Question): React.ReactNode => {
    const as = (q as any)?.styling?.as as string | undefined;
    if (as) return renderBlock(q);

    const name = (q.type as any)?.name as Question["type"]["name"];
    const isRequired = Boolean((q as any)?.validations?.required?.value);
    const labelBase = formatWithRefs(q.title ?? "", (id) =>
      runtime.context.get.value(id),
    );
    const labelText = isRequired ? `${labelBase} *` : labelBase;
    const helpText = q.description
      ? formatWithRefs(q.description, (id) => runtime.context.get.value(id))
      : null;
    const err = runtime.context.get.visibleError(q.id);
    const setVal = (v: unknown) => runtime.actions.set(q.id, v);

    if (name === "text") {
      const fmt = (q.type as any)?.format as string | undefined;
      // Phone number: use unified phone input (compact style for classic)
      if (fmt === "tel") {
        const value = String(runtime.context.get.value(q.id) ?? "");
        return (
          <div className="space-y-2">
            <Label>{labelText}</Label>
            {helpText ? (
              <div className="text-xs text-muted-foreground">{helpText}</div>
            ) : null}
            <UnifiedPhoneInput
              mode="chat"
              value={value}
              onChange={(v) => setVal(v ?? "")}
              placeholder="Enter phone number"
            />
            {err ? <div className="text-xs text-destructive">{err}</div> : null}
          </div>
        );
      }
      const inputType =
        fmt && ["email", "url", "password", "number"].includes(fmt)
          ? (fmt as any)
          : "text";
      const value = String(runtime.context.get.value(q.id) ?? "");
      const placeholder =
        fmt === "email"
          ? "name@company.com"
          : fmt === "url"
            ? "https://example.com"
            : fmt === "password"
              ? "••••••••"
              : undefined;
      return (
        <div className="space-y-2">
          <Label>{labelText}</Label>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <Input
            type={inputType}
            value={value}
            placeholder={placeholder}
            onChange={(e: any) => setVal(e.target.value)}
          />
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    if (name === "date") {
      const raw = runtime.context.get.value(q.id);
      const value = typeof raw === "string" ? raw : null;
      return (
        <div className="space-y-2">
          <Label>{labelText}</Label>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <UnifiedDatePicker
            mode="chat"
            value={value}
            onChange={(v) => setVal(v ?? "")}
            placeholder="Select date"
          />
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    if (name === "fileUpload") {
      return (
        <div className="space-y-2">
          <Label>{labelText}</Label>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <UnifiedFileUpload
            mode="chat"
            questionId={q.id}
            onFileUpload={async (id, file) => {
              const desc = await runtime.actions.upload(String(id), file);
              runtime.actions.set(String(id), desc);
            }}
          />
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    if (name === "singleChoice") {
      const raw = (q.type as any).options as Array<{
        value: string;
        label: string;
      }>;
      const options = raw.map((o) => ({ value: o.value, label: o.label }));
      const val = runtime.context.get.value<string | null>(q.id) ?? null;
      // Radio group
      return (
        <div className="space-y-2">
          <Label>{labelText}</Label>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <div className="flex flex-col gap-2">
            {options.map((o) => (
              <label key={o.value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={q.id}
                  value={o.value}
                  checked={val === o.value}
                  onChange={() => setVal(o.value)}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    if (name === "multipleChoice") {
      const raw = (q.type as any).options as Array<{
        value: string;
        label: string;
      }>;
      const options = raw.map((o) => ({ value: o.value, label: o.label }));
      const rawVal = runtime.context.get.value(q.id);
      const valArr: string[] = Array.isArray(rawVal)
        ? (rawVal as string[])
        : typeof rawVal === "string"
          ? (() => {
              try {
                const parsed = JSON.parse(rawVal);
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()
          : [];
      return (
        <div className="space-y-2">
          <Label>{labelText}</Label>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <div className="flex flex-col gap-2">
            {options.map((o) => {
              const checked = valArr.includes(o.value);
              return (
                <label key={o.value} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(valArr);
                      if (e.currentTarget.checked) next.add(o.value);
                      else next.delete(o.value);
                      setVal(Array.from(next));
                    }}
                  />
                  <span>{o.label}</span>
                </label>
              );
            })}
          </div>
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    if (name === "rating") {
      const cfg = (q.type as any)?.config as
        | { min?: number; max?: number; step?: number }
        | undefined;
      const max = cfg?.max ?? 5;
      const val = runtime.context.get.value<number | null>(q.id) ?? null;
      const nums = Array.from({ length: max }, (_, i) => i + 1);
      return (
        <div className="space-y-2">
          <Label>{labelText}</Label>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <div className="flex gap-2">
            {nums.map((n) => (
              <Btn
                key={n}
                type="button"
                className={`px-2 py-1 rounded-md border ${val === n ? "bg-primary text-primary-foreground" : "bg-background"}`}
                onClick={() => setVal(n)}
              >
                {n}
              </Btn>
            ))}
          </div>
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    if (name === "linearScale") {
      const cfg = (q.type as any)?.config as {
        start: number;
        end: number;
        step?: number;
        startLabel?: string;
        endLabel?: string;
      };
      const val = runtime.context.get.value<number | null>(q.id) ?? null;
      const step = cfg?.step ?? 1;
      const nums = Array.from(
        { length: Math.floor((cfg.end - cfg.start) / step) + 1 },
        (_, i) => cfg.start + i * step,
      );
      return (
        <div className="space-y-2">
          <Label>{labelText}</Label>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <div className="flex items-center gap-2 flex-wrap">
            {cfg?.startLabel ? (
              <span className="text-xs text-muted-foreground">
                {cfg.startLabel}
              </span>
            ) : null}
            {nums.map((n) => (
              <Btn
                key={n}
                type="button"
                className={`px-2 py-1 rounded-md border ${val === n ? "bg-primary text-primary-foreground" : "bg-background"}`}
                onClick={() => setVal(n)}
              >
                {n}
              </Btn>
            ))}
            {cfg?.endLabel ? (
              <span className="text-xs text-muted-foreground">
                {cfg.endLabel}
              </span>
            ) : null}
          </div>
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    if (name === "likertScale") {
      const options = (q.type as any)?.options as string[];
      const val = runtime.context.get.value<string | null>(q.id) ?? null;
      return (
        <div className="space-y-2">
          <Label>{labelText}</Label>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <div className="flex flex-col gap-2">
            {options.map((o) => (
              <label key={o} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={q.id}
                  value={o}
                  checked={val === o}
                  onChange={() => setVal(o)}
                />
                <span>{o}</span>
              </label>
            ))}
          </div>
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    // (date and fileUpload handled above with Unified components)

    if (name === "address") {
      const raw = runtime.context.get.value(q.id);
      const value =
        typeof raw === "string" ? raw : JSON.stringify(raw ?? {}, null, 2);
      return (
        <div className="space-y-2">
          <Label>{labelText}</Label>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <Textarea
            value={value}
            onChange={(e: any) => setVal(e.target.value)}
            placeholder="Enter address or JSON object"
          />
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <Label>{labelText}</Label>
        {helpText ? (
          <div className="text-xs text-muted-foreground">{helpText}</div>
        ) : null}
        <div className="mt-2 text-sm text-muted-foreground">
          Unsupported question type.
        </div>
        {err ? <div className="text-xs text-destructive">{err}</div> : null}
      </div>
    );
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-semibold">{runtime.context.form.title}</h1>
      {runtime.context.form.description ? (
        <p className="text-muted-foreground mt-2">
          {formatWithRefs(runtime.context.form.description, (id) =>
            runtime.context.get.value(id),
          )}
        </p>
      ) : null}

      {/* Branch-aware progress (based on runtime.context.progress) */}
      <div className="mt-2 text-right text-sm text-muted-foreground">
        {snap.progress.index + 1} of {snap.progress.total}
      </div>

      {snap.status !== "completed" ? (
        <form
          className="mt-8 space-y-6"
          onSubmit={async (e) => {
            e.preventDefault();
            // Let the runtime handle reveal-on-fail and submission in one place
            await runtime.actions.submit();
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {nodes.map((n: any, idx: number) => {
              const isField = n?.kind === "field";
              if (isField) {
                const col = Math.min(Math.max(Number(n?.colSpan ?? 12), 1), 12);
                const spanClass = SPAN_MD[col] ?? "md:col-span-12";
                const q = runtime.context.get.q(String(n.qId)) as
                  | Question
                  | undefined;
                if (!q) return null;
                const customFieldRenderer = (n as any)?.node as
                  | undefined
                  | ((ctx: {
                      q: Question;
                      question: Question;
                      value: unknown;
                      set: (v: unknown) => void;
                      error?: string;
                      runtime: typeof runtime;
                    }) => React.ReactNode);
                const err = runtime.context.get.visibleError(q.id);
                const val = runtime.context.get.value(q.id);
                return (
                  <div
                    key={n.id ?? n.qId ?? idx}
                    data-fl-qid={q.id}
                    className={`col-span-12 ${spanClass}`}
                  >
                    {typeof customFieldRenderer === "function"
                      ? customFieldRenderer({
                          q,
                          question: q,
                          value: val,
                          set: (v) => runtime.actions.set(q.id, v),
                          error: err,
                          runtime,
                        })
                      : renderField(q)}
                  </div>
                );
              }
              // element node or legacy question fallback
              if ((n as any)?.kind === "element") {
                const col = Math.min(Math.max(Number(n?.colSpan ?? 12), 1), 12);
                const spanClass = SPAN_MD[col] ?? "md:col-span-12";
                return (
                  <div key={n.id ?? idx} className={`col-span-12 ${spanClass}`}>
                    {renderBlock(n)}
                  </div>
                );
              }
              const q = n as Question;
              const raw = Math.min(
                Math.max((q as any)?.styling?.colSpan ?? 12, 1),
                12,
              );
              const spanClass = SPAN_MD[raw] ?? "md:col-span-12";
              return (
                <div
                  key={q.id ?? idx}
                  data-fl-qid={q.id}
                  className={`col-span-12 ${spanClass}`}
                >
                  {renderField(q)}
                </div>
              );
            })}
          </div>
          {showDefaultSubmit && (
            <div className="pt-4">
              <Btn type="submit" className="px-4 py-2 rounded-md border">
                Submit
              </Btn>
            </div>
          )}
        </form>
      ) : (
        <div className="mt-8 rounded-md border p-4">
          Thanks — recorded!
          <Btn
            className="ml-2 px-3 py-1.5 rounded-md border"
            type="button"
            onClick={() => {
              runtime.actions.reset();
              runtime.actions.start();
            }}
          >
            Restart
          </Btn>
        </div>
      )}
    </main>
  );
}

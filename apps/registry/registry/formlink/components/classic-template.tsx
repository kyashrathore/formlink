"use client";

import * as React from "react";
import { useSyncExternalStore } from "react";
import type { RuntimeApi } from "@formlink/runtime";
import type { Question } from "@formlink/runtime/schema";
import { ShadCnProvider, useUiComponents } from "@formlink/runtime/ui/react";
import { UnifiedPhoneInput } from "@formlink/runtime/ui/react";
import { UnifiedFileUpload } from "@formlink/runtime/ui/react";
import { UnifiedDatePicker } from "@formlink/runtime/ui/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover as PopoverRoot,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from "@/components/ui/popover";
import {
  Command as CommandRoot,
  CommandList,
  CommandItem,
  CommandGroup,
  CommandEmpty,
  CommandInput,
  CommandSeparator,
} from "@/components/ui/command";

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

function ClassicTemplateInner({
  runtime,
  nodes: propNodes,
  showDefaultSubmit = true,
}: {
  runtime: RuntimeApi;
  nodes?: any[];
  showDefaultSubmit?: boolean;
}): React.JSX.Element | null {
  const primitives = useUiComponents();
  const Btn =
    (primitives.Button as React.ElementType | undefined) ?? ("button" as any);
  const InputComp =
    (primitives.Input as React.ElementType | undefined) ?? ("input" as any);
  const TextareaComp =
    (primitives.Textarea as React.ElementType | undefined) ??
    ("textarea" as any);
  const LabelComp =
    (primitives.Label as React.ElementType | undefined) ?? ("label" as any);
  const SeparatorComp =
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
    const nodeFn = (q as any)?.node as
      | undefined
      | ((schema: any) => React.ReactNode);
    if (typeof nodeFn === "function") {
      try {
        return nodeFn(q);
      } catch {}
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
          <SeparatorComp className="flex-1" />
          <span className="text-xs uppercase tracking-wide text-muted-foreground">
            {title || "or"}
          </span>
          <SeparatorComp className="flex-1" />
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
      if (fmt === "tel") {
        const value = String(runtime.context.get.value(q.id) ?? "");
        return (
          <div className="space-y-2">
            <LabelComp>{labelText}</LabelComp>
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
          <LabelComp>{labelText}</LabelComp>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <InputComp
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
          <LabelComp>{labelText}</LabelComp>
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
          <LabelComp>{labelText}</LabelComp>
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
      return (
        <div className="space-y-2">
          <LabelComp>{labelText}</LabelComp>
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
          <LabelComp>{labelText}</LabelComp>
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
      const min = cfg?.min ?? 1;
      const max = cfg?.max ?? 5;
      const step = cfg?.step ?? 1;
      const value = runtime.context.get.value<number | null>(q.id) ?? null;
      return (
        <div className="space-y-2">
          <LabelComp>{labelText}</LabelComp>
          {helpText ? (
            <div className="text-xs text-muted-foreground">{helpText}</div>
          ) : null}
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value ?? min}
            onChange={(e: any) => setVal(Number(e.target.value))}
          />
          {err ? <div className="text-xs text-destructive">{err}</div> : null}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <LabelComp>{labelText}</LabelComp>
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

      <div className="mt-2 text-right text-sm text-muted-foreground">
        {snap.progress.index + 1} of {snap.progress.total}
      </div>

      {snap.status !== "completed" ? (
        <form
          className="mt-8 space-y-6"
          onSubmit={async (e) => {
            e.preventDefault();
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

export function ClassicTemplate(props: {
  runtime: RuntimeApi;
  nodes?: any[];
  showDefaultSubmit?: boolean;
}) {
  return (
    <ShadCnProvider
      components={{
        Button,
        Input,
        Textarea,
        Label,
        Badge,
        ScrollArea,
        Separator,
        Calendar,
        Avatar,
        AvatarImage,
        AvatarFallback,
        PopoverRoot,
        PopoverTrigger,
        PopoverContent,
        PopoverAnchor,
        CommandRoot,
        CommandList,
        CommandItem,
        CommandGroup,
        CommandEmpty,
        CommandInput,
        CommandSeparator,
      }}
    >
      <ClassicTemplateInner {...props} />
    </ShadCnProvider>
  );
}

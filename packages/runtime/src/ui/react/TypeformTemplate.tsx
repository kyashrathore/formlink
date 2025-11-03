"use client";
import * as React from "react";
import type { FormlinkFlow } from "../../core/formlinkFlow";
import type { Question } from "../../schema";
import { useRuntime } from "./runtime-context";
import { useUiComponents } from "./primitives/context";
import { TypeFormLayout } from "./typeform/Layout";
import { TypeFormProgress } from "./typeform/Progress";
import { TypeFormNavigation } from "./typeform/Navigation";
import { TypeFormQuestionHeader } from "./typeform/QuestionHeader";
import { TypeFormContinueFooter } from "./typeform/ContinueFooter";
import { TypeFormTransition } from "./typeform/Transition";
import { buildCountryOptions } from "./country-utils";
import { InlineSelect } from "./InlineSelect";
import { InlineMultiSelect } from "./InlineMultiSelect";
import { InlineRating } from "./InlineRating";
import { InlineRanking } from "./InlineRanking";
import {
  UnifiedLinearScale,
  type LinearScaleConfig,
} from "./UnifiedLinearScale";
import { UnifiedCountrySelect } from "./UnifiedCountrySelect";
import { UnifiedDatePicker } from "./UnifiedDatePicker";
import { UnifiedDropdownSelect } from "./UnifiedDropdownSelect";
import { UnifiedDropdownMultiSelect } from "./UnifiedDropdownMultiSelect";
import { UnifiedLikert } from "./UnifiedLikert";
import { UnifiedPhoneInput } from "./UnifiedPhoneInput";
import { UnifiedFileUpload } from "./UnifiedFileUpload";
import { UnifiedAddressInput } from "./UnifiedAddressInput";
import { InlineSignature } from "./InlineSignature";
import { TypeFormTextInput } from "./typeform/TypeFormTextInput";
import { useTypeformScaffold } from "@/headless/react/hooks/useTypeformScaffold";
import { useAutoAdvanceOnce } from "@/headless/react/hooks/useAutoAdvanceOnce";

const DEFAULT_AUTO_ADVANCE_MS = 480;

export function TypeformTemplate({
  flowEngine,
}: {
  flowEngine?: FormlinkFlow;
}): React.JSX.Element | null {
  const runtime = useRuntime();
  if (!runtime) return null;
  const primitives = useUiComponents();
  const ButtonPrimitive = primitives.Button as React.ElementType | undefined;

  const scaffold = useTypeformScaffold({
    runtime,
    flowEngine,
    autoAdvanceDelayMs: DEFAULT_AUTO_ADVANCE_MS,
  });
  const {
    q,
    qId,
    qNumber,
    derivedIndex,
    derivedTotal,
    direction,
    scopeRef,
    onContinue,
    onBack,
    onAutoAdvance,
    errorMessage,
    snap,
  } = scaffold;

  const renderBody = React.useCallback(
    ({
      q,
      runtime,
      onContinue,
      onAutoAdvance,
      setValue,
    }: {
      q: Question;
      runtime: ReturnType<typeof useRuntime> extends infer R
        ? Exclude<R, null>
        : never;
      onContinue: () => Promise<void>;
      onAutoAdvance: () => Promise<void>;
      setValue: (v: unknown) => void;
    }) => {
      const name = (q.type as any)?.name as Question["type"]["name"];
      if (name === "text") {
        const fmt = (q.type as any)?.format as string | undefined;
        if (fmt === "textarea") {
          const val = String(runtime.context.get.value(q.id) ?? "");
          return (
            <div className="w-full max-w-2xl space-y-2">
              <textarea
                className={[
                  "w-full min-h-28 px-0 py-3 text-2xl md:text-3xl font-light",
                  "bg-transparent border-0 border-b-2 border-border/30",
                  "focus:outline-none focus:border-b-primary transition-colors duration-200",
                  "placeholder:text-muted-foreground/50",
                ].join(" ")}
                value={val}
                placeholder="Type your answer…"
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void onContinue();
                  }
                }}
                aria-label={q.title}
              />
              <div className="text-xs text-muted-foreground">
                Shift+Enter for a new line
              </div>
            </div>
          );
        }
        if (fmt === "country") {
          const countryOptions = buildCountryOptions();
          const val = runtime.context.get.value<string | null>(q.id) ?? null;
          return (
            <UnifiedCountrySelect
              mode="typeform"
              options={countryOptions}
              value={val}
              onChange={setValue}
              onSubmit={onAutoAdvance}
            />
          );
        }
        if (fmt === "tel") {
          const val = String(runtime.context.get.value(q.id) ?? "");
          return (
            <UnifiedPhoneInput
              mode="typeform"
              value={val}
              onChange={setValue}
              preventInvalidSubmit
              onSubmit={onContinue}
            />
          );
        }
        const inputType =
          fmt && ["email", "url", "password", "number"].includes(fmt)
            ? (fmt as any)
            : "text";
        return (
          <TypeFormTextInput
            type={inputType}
            value={String(runtime.context.get.value(q.id) ?? "")}
            onChange={setValue}
            onSubmit={onContinue}
            placeholder="Type your answer…"
          />
        );
      }

      if (name === "singleChoice") {
        const raw = (q.type as any).options as Array<{
          value: string;
          label: string;
        }>;
        const options = raw.map((o) => ({ value: o.value, label: o.label }));
        const val = runtime.context.get.value<string | null>(q.id) ?? null;
        if (options.length > 0 && options.length < 6) {
          return (
            <InlineSelect
              options={options}
              value={val}
              onChange={setValue}
              onSubmit={onAutoAdvance}
              autoFocus
              showKeyboardHints
            />
          );
        }
        return (
          <UnifiedDropdownSelect
            mode="typeform"
            options={options}
            value={val}
            onChange={setValue}
            onSubmit={onAutoAdvance}
            placeholder="Select an option…"
          />
        );
      }

      if (name === "multipleChoice") {
        const raw = (q.type as any).options as Array<{
          value: string;
          label: string;
        }>;
        const options = raw.map((o) => ({ value: o.value, label: o.label }));
        const stored = runtime.context.get.value<unknown>(q.id);
        const val = Array.isArray(stored)
          ? (stored as string[])
          : typeof stored === "string" && stored.length > 0
            ? stored
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : [];
        if (options.length > 0 && options.length < 6) {
          return (
            <InlineMultiSelect
              options={options}
              value={val}
              onChange={setValue}
              onSubmit={onContinue}
            />
          );
        }
        return (
          <UnifiedDropdownMultiSelect
            mode="typeform"
            options={options}
            value={val}
            onChange={setValue}
            onSubmit={onContinue}
            placeholder="Select one or more…"
          />
        );
      }

      if (name === "rating") {
        const max = (q.type as any)?.config?.max ?? 5;
        const stored = runtime.context.get.value<number | null>(q.id) ?? null;
        return (
          <InlineRating
            max={max}
            value={stored}
            onChange={setValue}
            onSubmit={onAutoAdvance}
          />
        );
      }

      if (name === "linearScale") {
        const rawCfg = (q.type as any)?.config as {
          start: number;
          end: number;
          step?: number;
          startLabel?: string;
          endLabel?: string;
        };
        const cfg: LinearScaleConfig = {
          start: rawCfg.start,
          end: rawCfg.end,
          step: rawCfg.step ?? 1,
          startLabel: rawCfg.startLabel,
          endLabel: rawCfg.endLabel,
        };
        const val = runtime.context.get.value<number | null>(q.id) ?? null;
        return (
          <UnifiedLinearScale
            mode="typeform"
            value={val}
            onChange={setValue}
            onSubmit={onAutoAdvance}
            config={cfg}
          />
        );
      }

      if (name === "likertScale") {
        const options = (q.type as any)?.options as string[];
        const val = runtime.context.get.value<string | null>(q.id) ?? null;
        return (
          <UnifiedLikert
            mode="typeform"
            options={options}
            value={val}
            onChange={setValue}
            onSubmit={onContinue}
          />
        );
      }

      if (name === "ranking") {
        const raw = (q.type as any).options as Array<{
          value: string;
          label: string;
        }>;
        const options = raw.map((o) => ({ value: o.value, label: o.label }));
        const val = (runtime.context.get.value<string[] | null>(q.id) ??
          []) as string[];
        return (
          <InlineRanking
            options={options}
            value={val}
            onChange={setValue}
            onSubmit={onContinue}
          />
        );
      }

      if (name === "date") {
        const rawVal = runtime.context.get.value(q.id);
        const value: string | null = typeof rawVal === "string" ? rawVal : null;
        return (
          <UnifiedDatePicker
            mode="typeform"
            value={value}
            onChange={setValue}
            onSubmit={onAutoAdvance}
          />
        );
      }

      if (name === "fileUpload") {
        return (
          <UnifiedFileUpload
            mode="typeform"
            questionId={q.id}
            onFileUpload={
              ((qidOrFiles: any, maybeFile?: File) => {
                // Support both handler shapes used by UnifiedFileUpload
                const qid = typeof qidOrFiles === "string" ? qidOrFiles : q.id;
                const file =
                  typeof qidOrFiles === "string"
                    ? maybeFile
                    : Array.isArray(qidOrFiles)
                      ? qidOrFiles[0]
                      : undefined;
                if (!file) return Promise.resolve();
                return runtime.actions.upload(qid, file).then((desc) => {
                  runtime.actions.set(qid, desc as any);
                });
              }) as any
            }
          />
        );
      }

      if (name === "address") {
        const value =
          runtime.context.get.value<Record<string, unknown> | null>(q.id) ??
          null;
        return (
          <UnifiedAddressInput
            mode="typeform"
            value={value as any}
            onChange={setValue}
            onSubmit={onContinue}
          />
        );
      }

      if (name === "signature") {
        const value = runtime.context.get.value<string | null>(q.id) ?? null;
        return (
          <InlineSignature
            value={value}
            onChange={(dataUrl) => setValue(dataUrl)}
          />
        );
      }

      return (
        <div className="rounded-md border border-dashed border-muted py-6 text-center text-sm text-muted-foreground">
          Unsupported question type in this template.
        </div>
      );
    },
    [],
  );

  // Prepare control and auto-advance detection (only relevant during filling)
  const setValue = (v: unknown) => {
    if (q) runtime.actions.set(q.id, v);
  };
  const controlNode =
    snap.status === "filling" && q
      ? renderBody({ q, runtime, onContinue, onAutoAdvance, setValue })
      : null;
  const shouldAutoAdvance =
    snap.status === "filling" && Boolean(q && controlNode === null);
  useAutoAdvanceOnce({
    qId,
    shouldAdvance: Boolean(shouldAutoAdvance),
    delayMs: DEFAULT_AUTO_ADVANCE_MS,
    isLast: scaffold.isLast,
    onNext: () => runtime.actions.next(),
    onSubmit: () => runtime.actions.submit(),
  });

  const Btn = ButtonPrimitive ?? ("button" as any);
  const startContent = (
    <div className="space-y-6">
      <h1 className="text-3xl md:text-4xl font-semibold">
        {runtime.context.form.title}
      </h1>
      {runtime.context.form.description ? (
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
          {runtime.context.form.description}
        </p>
      ) : null}
      <div className="pt-2">
        <Btn
          onClick={() => runtime.actions.start()}
          className="px-4 py-2 rounded-md border"
        >
          Start
        </Btn>
      </div>
    </div>
  );
  const completedContent = (
    <div className="space-y-4">
      <h2 className="text-2xl md:text-3xl font-semibold">Thanks — recorded!</h2>
      <p className="text-muted-foreground">You can restart to try again.</p>
      <div className="pt-2">
        <Btn
          onClick={() => {
            runtime.actions.reset();
            runtime.actions.start();
          }}
          className="px-3 py-1.5 rounded-md border"
        >
          Restart
        </Btn>
      </div>
    </div>
  );

  const fillingContent = (
    <>
      <TypeFormProgress
        progress={Math.max(
          0,
          Math.min(
            100,
            Math.round(((derivedIndex + 1) / Math.max(1, derivedTotal)) * 100),
          ),
        )}
        current={derivedIndex + 1}
        total={derivedTotal}
      />
      <div ref={scopeRef}>
        <TypeFormTransition questionId={qId ?? "intro"} direction={direction}>
          {q ? (
            <>
              <TypeFormQuestionHeader question={q} questionNumber={qNumber} />
              <div className="mt-6 space-y-6">
                {controlNode}
                {qId && errorMessage ? (
                  <p className="text-sm text-destructive">{errorMessage}</p>
                ) : null}
              </div>
              <TypeFormContinueFooter
                onClick={onContinue}
                isLoadingNext={snap.isSubmitting}
                errorMessage={errorMessage}
              />
            </>
          ) : null}
        </TypeFormTransition>
      </div>
      <TypeFormNavigation
        onPrevious={onBack}
        onNext={onContinue}
        canGoPrevious={scaffold.snap.progress.index > 0}
        canGoNext={!snap.isSubmitting}
        isLoadingNext={snap.isSubmitting}
      />
    </>
  );

  return (
    <TypeFormLayout>
      {snap.status === "idle"
        ? startContent
        : snap.status === "completed"
          ? completedContent
          : fillingContent}
    </TypeFormLayout>
  );
}

"use client";
import * as React from "react";
import { useSyncExternalStore } from "react";
import type { Question } from "../../schema";
import { useRuntime } from "./runtime-context";
import { TypeFormLayout } from "./typeform/Layout";
import { TypeFormProgress } from "./typeform/Progress";
import { TypeFormQuestionHeader } from "./typeform/QuestionHeader";
import { TypeFormTransition } from "./typeform/Transition";
import { TypeFormContinueFooter } from "./typeform/ContinueFooter";
import { TypeFormNavigation } from "./typeform/Navigation";
import { TypeFormTextInput } from "./typeform/TypeFormTextInput";
import { InlineSelect } from "./InlineSelect";
import { InlineMultiSelect } from "./InlineMultiSelect";
import { InlineRating } from "./InlineRating";
import { InlineRanking } from "./InlineRanking";
import { UnifiedDropdownSelect } from "./UnifiedDropdownSelect";
import { UnifiedDropdownMultiSelect } from "./UnifiedDropdownMultiSelect";
import { UnifiedCountrySelect } from "./UnifiedCountrySelect";
import { UnifiedDatePicker } from "./UnifiedDatePicker";
import { UnifiedFileUpload } from "./UnifiedFileUpload";
import { UnifiedPhoneInput } from "./UnifiedPhoneInput";
import { UnifiedAddressInput } from "./UnifiedAddressInput";
import { UnifiedLikert } from "./UnifiedLikert";
import {
  UnifiedLinearScale,
  type LinearScaleConfig,
} from "./UnifiedLinearScale";
import { buildCountryOptions } from "./country-utils";
import { usePrimitives } from "./primitives/context";

type RuntimeQuestion = Question;

function formatWithRefs(
  text: string,
  getValue: (qId: string) => unknown,
): string {
  return text.replace(/\{\{(.*?)\}\}/g, (_m, id) => {
    const val = getValue(String(id).trim());
    return val == null ? "" : String(val);
  });
}

export function UniversalTypeform(): React.JSX.Element | null {
  const runtime = useRuntime();
  const primitives = usePrimitives();
  const ButtonPrimitive = primitives.Button as React.ElementType | undefined;

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

  const qId = snap.currentId ?? snap.firstUnansweredId ?? null;
  const q = qId
    ? (runtime.context.get.q(qId) as RuntimeQuestion | undefined)
    : undefined;
  const qNumber = snap.progress.index + 1;

  const handleStart = React.useCallback(
    () => runtime.actions.start(),
    [runtime],
  );
  const handleRestart = React.useCallback(() => {
    runtime.actions.reset();
    runtime.actions.start();
  }, [runtime]);
  const handleBack = React.useCallback(() => runtime.actions.prev(), [runtime]);
  const handleContinue = React.useCallback(async () => {
    if (!qId) {
      await runtime.actions.next();
      return;
    }
    const res = await runtime.actions.validate(qId);
    if (res.isValid) {
      const isLast = snap.progress.index + 1 >= snap.progress.total;
      if (isLast) await runtime.actions.submit();
      else await runtime.actions.next();
    }
  }, [qId, runtime, snap.progress.index, snap.progress.total]);

  const renderControl = React.useCallback((): React.ReactNode => {
    if (!q)
      return (
        <p className="text-muted-foreground">
          Answer the questions to continue.
        </p>
      );

    const name = (q.type as any)?.name as RuntimeQuestion["type"]["name"]; // discriminant
    const setVal = (v: unknown) => runtime.actions.set(q.id, v);

    if (name === "text") {
      const fmt = (q.type as any)?.format as string | undefined;
      if (fmt === "country") {
        const countryOptions = buildCountryOptions();
        const val = runtime.context.get.value<string | null>(q.id) ?? null;
        return (
          <UnifiedCountrySelect
            mode="typeform"
            options={countryOptions}
            value={val}
            onChange={setVal}
            onSubmit={handleContinue}
          />
        );
      }
      if (fmt === "tel") {
        const val = String(runtime.context.get.value(q.id) ?? "");
        return (
          <UnifiedPhoneInput
            mode="typeform"
            value={val}
            onChange={setVal}
            preventInvalidSubmit
            onSubmit={handleContinue}
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
          onChange={setVal}
          onSubmit={handleContinue}
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
            onChange={setVal}
            onSubmit={handleContinue}
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
          onChange={setVal}
          onSubmit={handleContinue}
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
            onChange={setVal}
            onSubmit={handleContinue}
          />
        );
      }
      return (
        <UnifiedDropdownMultiSelect
          mode="typeform"
          options={options}
          value={val}
          onChange={setVal}
          onSubmit={handleContinue}
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
          onChange={setVal}
          onSubmit={handleContinue}
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
          onChange={setVal}
          onSubmit={handleContinue}
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
          onChange={setVal}
          onSubmit={handleContinue}
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
          onChange={setVal}
          onSubmit={handleContinue}
        />
      );
    }

    if (name === "date") {
      const rawVal = runtime.context.get.value(q.id);
      const value: string | null = typeof rawVal === "string" ? rawVal : null;
      return (
        <UnifiedDatePicker mode="typeform" value={value} onChange={setVal} />
      );
    }

    if (name === "fileUpload") {
      return (
        <UnifiedFileUpload
          mode="typeform"
          questionId={q.id}
          onFileUpload={
            ((qidOrFile: any, maybeFile?: File) => {
              const qid = typeof qidOrFile === "string" ? qidOrFile : q.id;
              const file =
                typeof qidOrFile === "string"
                  ? maybeFile
                  : (qidOrFile?.[0] as File | undefined);
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
        runtime.context.get.value<Record<string, unknown> | null>(q.id) ?? null;
      return (
        <UnifiedAddressInput
          mode="typeform"
          value={value}
          onChange={setVal}
          onSubmit={handleContinue}
        />
      );
    }

    return (
      <div className="rounded-md border border-dashed border-muted py-6 text-center text-sm text-muted-foreground">
        Unsupported question type in this renderer.
      </div>
    );
  }, [q, runtime, handleContinue]);

  // IDLE screen
  if (snap.status === "idle") {
    const Btn = ButtonPrimitive ?? ("button" as any);
    return (
      <TypeFormLayout>
        <div className="space-y-6">
          <h1 className="text-3xl md:text-4xl font-semibold">
            {runtime.context.form.title}
          </h1>
          {runtime.context.form.description ? (
            <p className="text-muted-foreground text-base md:text-lg max-w-2xl">
              {formatWithRefs(runtime.context.form.description, (id) =>
                runtime.context.get.value(id),
              )}
            </p>
          ) : null}
          <div className="pt-2">
            <Btn onClick={handleStart} className="px-4 py-2 rounded-md border">
              Start
            </Btn>
          </div>
        </div>
      </TypeFormLayout>
    );
  }

  // COMPLETED screen
  if (snap.status === "completed") {
    const Btn = ButtonPrimitive ?? ("button" as any);
    return (
      <TypeFormLayout>
        <div className="space-y-4">
          <h2 className="text-2xl md:text-3xl font-semibold">
            Thanks — recorded!
          </h2>
          <p className="text-muted-foreground">You can restart to try again.</p>
          <div className="pt-2">
            <Btn
              onClick={handleRestart}
              className="px-3 py-1.5 rounded-md border"
            >
              Restart
            </Btn>
          </div>
        </div>
      </TypeFormLayout>
    );
  }

  // MAIN screen
  return (
    <TypeFormLayout>
      <TypeFormProgress
        progress={snap.progress.percent}
        current={snap.progress.index + 1}
        total={snap.progress.total}
      />
      <TypeFormTransition questionId={qId ?? "intro"}>
        {q && (
          <>
            <TypeFormQuestionHeader question={q} questionNumber={qNumber} />
            <div className="mt-6 space-y-6">
              {(() => {
                const node = renderControl();
                if (node === null) {
                  const isLast = snap.progress.index + 1 >= snap.progress.total;
                  Promise.resolve().then(async () => {
                    if (isLast) await runtime.actions.submit();
                    else await runtime.actions.next();
                  });
                  return null;
                }
                return node;
              })()}
              {qId && runtime.context.get.visibleError(qId) ? (
                <p className="text-sm text-destructive">
                  {runtime.context.get.visibleError(qId)}
                </p>
              ) : null}
            </div>
            <TypeFormContinueFooter
              onClick={handleContinue}
              isLoadingNext={snap.isSubmitting}
              errorMessage={
                qId ? runtime.context.get.visibleError(qId) : undefined
              }
            />
          </>
        )}
      </TypeFormTransition>
      {snap.status === "filling" && (
        <TypeFormNavigation
          onPrevious={handleBack}
          onNext={handleContinue}
          isLoadingNext={snap.isSubmitting}
        />
      )}
    </TypeFormLayout>
  );
}

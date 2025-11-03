"use client";
import * as React from "react";
import type { FormlinkFlow } from "../../../core/formlinkFlow";
import type { RuntimeApi } from "../../../types";
import { useTypeformComputed } from "./useTypeformComputed";
import { useTransitionDirection } from "./useTransitionDirection";
import {
  useTypeformKeyboard,
  type TypeformKeyboardFeatures,
} from "./useTypeformKeyboard";

export type UseTypeformScaffoldOptions = {
  runtime: RuntimeApi;
  flowEngine?: FormlinkFlow;
  autoAdvanceDelayMs?: number; // used by onAutoAdvance
  keyboard?: { enterToContinue?: boolean } & Partial<TypeformKeyboardFeatures>;
  isOverlayOpen?: boolean;
  isMobile?: boolean;
};

export function useTypeformScaffold(options: UseTypeformScaffoldOptions) {
  const {
    runtime,
    flowEngine,
    autoAdvanceDelayMs = 480,
    keyboard,
    isOverlayOpen = false,
    isMobile = false,
  } = options;

  const computed = useTypeformComputed(runtime, flowEngine);
  const {
    qId,
    q,
    qNumber,
    derivedIndex,
    derivedTotal,
    isLast,
    errorMessage,
    snap,
  } = computed;

  const { direction, hintNext, hintPrev } =
    useTransitionDirection(derivedIndex);

  const scopeRef = React.useRef<HTMLDivElement | null>(null);

  async function handleContinue(): Promise<void> {
    hintNext();
    if (!qId) {
      await runtime.actions.next();
      return;
    }
    const res = await runtime.actions.validate(qId);
    if (res.isValid) {
      if (isLast) await runtime.actions.submit();
      else await runtime.actions.next();
    }
  }

  function handlePrevious(): void {
    hintPrev();
    try {
      requestAnimationFrame(() => {
        runtime.actions.prev();
      });
    } catch {
      runtime.actions.prev();
    }
  }

  const onAutoAdvance = React.useCallback(async () => {
    hintNext();
    await new Promise((r) => setTimeout(r, Math.max(0, autoAdvanceDelayMs)));
    await handleContinue();
  }, [autoAdvanceDelayMs, qId]);

  // Keyboard wiring (global Enter + shortcuts)
  useTypeformKeyboard({
    scopeRef,
    enabled: snap.status === "filling",
    features: { enterToContinue: keyboard?.enterToContinue ?? true },
    runtime,
    onNext: handleContinue,
    isOverlayOpen,
    isMobile,
  });

  const value = qId ? runtime.context.get.value(qId) : undefined;
  const setValue = (v: unknown) => {
    if (!q) return;
    runtime.actions.set(q.id, v);
  };

  return {
    // computed
    snap,
    qId,
    q,
    qNumber,
    derivedIndex,
    derivedTotal,
    isLast,
    errorMessage,
    // direction + navigation
    direction,
    hintNext,
    hintPrev,
    scopeRef,
    // actions
    onContinue: handleContinue,
    onBack: handlePrevious,
    onAutoAdvance,
    // control helpers
    value,
    setValue,
    runtime,
  } as const;
}

"use client";
import * as React from "react";
import { useSyncExternalStore } from "react";
import type { FormlinkFlow } from "../../../core/formlinkFlow";
import type { Question } from "../../../schema";
import type { RuntimeApi, RuntimeContextSnapshot } from "../../../types";

export type TypeformComputed = {
  snap: RuntimeContextSnapshot;
  qId: string | null;
  q: Question | undefined;
  derivedIndex: number;
  derivedTotal: number;
  qNumber: number;
  isLast: boolean;
  errorMessage?: string;
};

export function useTypeformComputed(
  runtime: RuntimeApi,
  flowEngine?: FormlinkFlow,
): TypeformComputed {
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
    ? (runtime.context.get.q(qId) as Question | undefined)
    : undefined;

  const fullBranch = React.useMemo(() => {
    try {
      if (!flowEngine) return [] as string[];
      return flowEngine.path(snap.values);
    } catch {
      return [] as string[];
    }
  }, [flowEngine, snap.values]);

  const derivedIndex = React.useMemo(() => {
    if (!qId) return 0;
    const idx = fullBranch.length > 0 ? fullBranch.indexOf(qId) : -1;
    if (idx >= 0) return idx;
    return snap.progress.index;
  }, [qId, fullBranch, snap.progress.index]);

  const derivedTotal = React.useMemo(() => {
    return fullBranch.length > 0 ? fullBranch.length : snap.progress.total;
  }, [fullBranch.length, snap.progress.total]);

  const qNumber = derivedIndex + 1;
  const isLast = derivedIndex + 1 >= Math.max(1, derivedTotal);
  const errorMessage = qId ? runtime.context.get.visibleError(qId) : undefined;

  return {
    snap,
    qId,
    q,
    derivedIndex,
    derivedTotal,
    qNumber,
    isLast,
    errorMessage,
  } as TypeformComputed;
}

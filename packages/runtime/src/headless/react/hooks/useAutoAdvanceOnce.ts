"use client";
import * as React from "react";

export function useAutoAdvanceOnce(options: {
  qId: string | null;
  shouldAdvance: boolean;
  delayMs: number;
  isLast: boolean;
  onNext: () => Promise<void> | void;
  onSubmit: () => Promise<void> | void;
}): void {
  const { qId, shouldAdvance, delayMs, isLast, onNext, onSubmit } = options;
  const lastRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!shouldAdvance || !qId) return;
    if (lastRef.current === qId) return;
    let cancelled = false;
    lastRef.current = qId;
    const id = setTimeout(
      () => {
        if (cancelled) return;
        const run = async () => {
          if (isLast) await onSubmit();
          else await onNext();
        };
        void run();
      },
      Math.max(0, delayMs),
    );
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [qId, shouldAdvance, delayMs, isLast, onNext, onSubmit]);
}

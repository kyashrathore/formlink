"use client";
import * as React from "react";

/**
 * Computes slide direction for Typeform-like transitions.
 * - Uses an explicit one-shot hint when provided (next = +1, prev = -1).
 * - Falls back to comparing currentIndex to previous index.
 * - No Effects; refs update during render per React guidance.
 */
export function useTransitionDirection(currentIndex: number): {
  direction: number;
  hintNext: () => void;
  hintPrev: () => void;
} {
  const hintRef = React.useRef<number | null>(null);
  const prevIndexRef = React.useRef(currentIndex);
  const direction = (hintRef.current ??
    (currentIndex >= prevIndexRef.current ? 1 : -1)) as number;
  // Update refs during render cycle; no need for effects.
  prevIndexRef.current = currentIndex;
  if (hintRef.current != null) hintRef.current = null;

  const hintNext = React.useCallback(() => {
    hintRef.current = 1;
  }, []);
  const hintPrev = React.useCallback(() => {
    hintRef.current = -1;
  }, []);

  return { direction, hintNext, hintPrev };
}

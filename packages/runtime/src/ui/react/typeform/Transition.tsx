"use client";
import * as React from "react";
import { AnimatePresence, motion } from "motion/react";

// Framer-motion based question transition matching the working implementation
// in apps/formfiller TypeFormTransition. Enter slides from below when moving
// forward, and from above when moving backward. Exit mirrors the direction.
export function TypeFormTransition({
  children,
  questionId,
  direction = 1,
  prefersReducedMotion = false,
  durationMs = 460,
  axis = "y",
  distancePx = 100,
  easing = "cubic-bezier(0.16, 1, 0.3, 1)",
}: {
  children: React.ReactNode;
  questionId: string;
  direction?: number; // 1 forward, -1 backward
  prefersReducedMotion?: boolean;
  durationMs?: number; // accepted for interface parity
  axis?: "x" | "y"; // accepted for interface parity (we animate Y)
  distancePx?: number;
  easing?: string; // accepted for interface parity
}) {
  const [isReduced, setIsReduced] = React.useState(prefersReducedMotion);
  // Freeze the direction at the moment questionId changes to avoid
  // mismatches between exit and enter when navigating back.
  const lastDirRef = React.useRef(direction);
  const prevIdRef = React.useRef(questionId);
  if (questionId !== prevIdRef.current) {
    lastDirRef.current = direction;
    prevIdRef.current = questionId;
  }
  React.useEffect(() => {
    try {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const apply = () => setIsReduced(mq.matches || prefersReducedMotion);
      apply();
      mq.addEventListener("change", apply);
      return () => mq.removeEventListener("change", apply);
    } catch {
      // SSR/no-window safe
    }
  }, [prefersReducedMotion]);

  if (isReduced) return <>{children}</>;

  // Variants adapted from apps/formfiller/components/typeform/animations/questionTransitions.ts
  const variants = {
    enter: (dir: number) => ({
      x: axis === "x" ? (dir > 0 ? distancePx : -distancePx) : 0,
      y: axis === "y" ? (dir > 0 ? distancePx : -distancePx) : 0,
      opacity: 0,
      // Allow focus/keyboard during enter to support immediate Tab
      pointerEvents: "auto" as const,
    }),
    center: {
      x: 0,
      y: 0,
      opacity: 1,
      pointerEvents: "auto" as const,
    },
    exit: (dir: number) => ({
      x: axis === "x" ? (dir < 0 ? distancePx : -distancePx) : 0,
      y: axis === "y" ? (dir < 0 ? distancePx : -distancePx) : 0,
      opacity: 0,
      pointerEvents: "none" as const,
    }),
  } as const;

  // Spring transition tuned to feel smooth and non-jarring, similar to formfiller.
  const spring = { type: "spring", stiffness: 300, damping: 30 } as const;

  return (
    <div className="relative w-full">
      <AnimatePresence mode="wait" custom={lastDirRef.current}>
        <motion.div
          key={questionId}
          custom={lastDirRef.current}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={spring}
          className="w-full relative z-10 will-change-transform"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

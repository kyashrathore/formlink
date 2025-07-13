"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { questionVariants, questionTransition } from "./animations/questionTransitions";

interface TypeFormTransitionProps {
  children: React.ReactNode;
  questionId: string;
  direction?: number;
  prefersReducedMotion?: boolean;
}

export default function TypeFormTransition({
  children,
  questionId,
  direction = 1,
  prefersReducedMotion = false,
}: TypeFormTransitionProps) {
  const [isReducedMotion, setIsReducedMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setIsReducedMotion(mediaQuery.matches || prefersReducedMotion);

    const handleChange = (e: MediaQueryListEvent) => {
      setIsReducedMotion(e.matches || prefersReducedMotion);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [prefersReducedMotion]);

  if (isReducedMotion) {
    return <>{children}</>;
  }

  return (
    <AnimatePresence mode="wait" custom={direction}>
      <motion.div
        key={questionId}
        custom={direction}
        variants={questionVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={questionTransition}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
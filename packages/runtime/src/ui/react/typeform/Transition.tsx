"use client";
import * as React from "react";

export function TypeFormTransition({
  children,
  questionId,
  direction = 1,
  prefersReducedMotion = false,
}: {
  children: React.ReactNode;
  questionId: string;
  direction?: number;
  prefersReducedMotion?: boolean;
}) {
  const [reduced, setReduced] = React.useState(prefersReducedMotion);
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setReduced(mq.matches || prefersReducedMotion);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [prefersReducedMotion]);

  if (reduced) return <>{children}</>;

  // Simple CSS-based enter/exit via key remount
  return (
    <div
      key={questionId}
      className="w-full relative z-10 pointer-events-auto transition-opacity transition-transform duration-200"
      style={{ opacity: 1, transform: "translateY(0px)" }}
      data-direction={direction}
    >
      {children}
    </div>
  );
}

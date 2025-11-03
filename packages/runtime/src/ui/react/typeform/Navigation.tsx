"use client";
import type { ComponentPropsWithRef } from "react";
import * as React from "react";
import { useIsMobile } from "../hooks/use-mobile";
import { useUiComponents } from "../primitives/context";
import { useRuntime } from "../runtime-context";

export function TypeFormNavigation({
  onPrevious,
  onNext,
  canGoPrevious = false,
  canGoNext = false,
  isLoadingNext = false,
}: {
  onPrevious?: () => void;
  onNext?: () => void;
  canGoPrevious?: boolean;
  canGoNext?: boolean;
  isLoadingNext?: boolean;
}) {
  const primitives = useUiComponents();
  const ButtonPrimitive = primitives.Button;
  const Button: React.FC<ComponentPropsWithRef<"button">> =
    React.useMemo(() => {
      if (ButtonPrimitive) {
        const Element = ButtonPrimitive as React.ElementType;
        const Component: React.FC<ComponentPropsWithRef<"button">> = (props) =>
          React.createElement(Element, { type: "button", ...props });
        Component.displayName = "TypeFormNavigationButtonPrimitive";
        return Component;
      }
      const Fallback: React.FC<ComponentPropsWithRef<"button">> = (props) => (
        <button type="button" {...props} />
      );
      Fallback.displayName = "TypeFormNavigationButtonFallback";
      return Fallback;
    }, [ButtonPrimitive]);
  const isMobile = useIsMobile();
  const runtime = useRuntime();

  // Intentionally no global arrow key navigation. Arrow keys are reserved
  // for in-control interactions (e.g., rating/linear scale) to avoid
  // conflicting with question navigation.

  // Basic swipe detection on mobile to navigate between questions
  React.useEffect(() => {
    let startX = 0;
    let startY = 0;
    let tracking = false;
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0]!;
      startX = t.clientX;
      startY = t.clientY;
      tracking = true;
    };
    const handleTouchEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      // horizontal swipe with limited vertical movement
      if (Math.abs(dx) > 60 && Math.abs(dy) < 40) {
        if (dx < 0) handleNext(); // swipe left → next
        if (dx > 0) handlePrev(); // swipe right → prev
      }
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onNext, onPrevious, canGoNext, canGoPrevious, isLoadingNext, runtime]);

  const handlePrev = () => {
    if (onPrevious) return onPrevious();
    if (runtime) return runtime.actions.prev();
  };
  const handleNext = async () => {
    if (onNext) return onNext();
    if (!runtime) return;
    const currentId =
      runtime.context.currentId ?? runtime.context.firstUnansweredId ?? null;
    if (!currentId) return;
    const res = await runtime.actions.validate(currentId);
    if (res.isValid) await runtime.actions.next();
  };

  if (isMobile) {
    // Align navigation to bottom-right on mobile as well (compact buttons)
    return (
      <div
        className="fl-rt-nav-mobile absolute right-8 bottom-8 z-10 flex items-center gap-2 text-foreground"
        role="navigation"
      >
        <Button
          disabled={onPrevious ? !canGoPrevious : false}
          onClick={handlePrev}
          className="h-12 w-12 rounded-md border bg-background/95 text-foreground hover:bg-accent disabled:opacity-100 disabled:text-muted-foreground disabled:border-border/70"
          aria-label="Previous"
        >
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M12.707 4.293a1 1 0 010 1.414L9.414 9H16a1 1 0 110 2H9.414l3.293 3.293a1 1 0 01-1.414 1.414l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </Button>
        <Button
          disabled={onNext ? !canGoNext || isLoadingNext : isLoadingNext}
          onClick={handleNext}
          className="h-12 w-12 rounded-md border bg-background/95 text-foreground hover:bg-accent disabled:opacity-60"
          aria-label="Next"
        >
          {!isLoadingNext && (
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M7.293 4.293a1 1 0 000 1.414L10.586 9H4a1 1 0 100 2h6.586l-3.293 3.293a1 1 0 101.414 1.414l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {isLoadingNext && (
            <span className="h-4 w-4 inline-block animate-spin border-b-2 border-foreground rounded-full" />
          )}
        </Button>
      </div>
    );
  }
  return (
    <div
      className="fl-rt-nav-desktop absolute right-[12px] bottom-[12px] z-[1000] flex items-center gap-2 text-foreground"
      role="navigation"
    >
      <Button
        disabled={onPrevious ? !canGoPrevious : false}
        onClick={handlePrev}
        className="h-12 w-12 rounded-md border bg-background/95 text-foreground hover:bg-accent disabled:opacity-100 disabled:text-muted-foreground disabled:border-border/70"
        aria-label="Previous"
      >
        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M12.707 4.293a1 1 0 010 1.414L9.414 9H16a1 1 0 110 2H9.414l3.293 3.293a1 1 0 01-1.414 1.414l-5-5a1 1 0 010-1.414l5-5a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </Button>
      <Button
        disabled={onNext ? !canGoNext || isLoadingNext : isLoadingNext}
        onClick={handleNext}
        className="h-12 w-12 rounded-md border bg-background/95 text-foreground hover:bg-accent disabled:opacity-60"
        aria-label="Next"
      >
        {!isLoadingNext && (
          <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M7.293 4.293a1 1 0 000 1.414L10.586 9H4a1 1 0 100 2h6.586l-3.293 3.293a1 1 0 101.414 1.414l5-5a1 1 0 000-1.414l-5-5a1 1 0 00-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {isLoadingNext && (
          <span className="h-4 w-4 inline-block animate-spin border-b-2 border-foreground rounded-full" />
        )}
      </Button>
    </div>
  );
}

"use client";
import * as React from "react";
import type { ComponentPropsWithRef } from "react";
import { useIsMobile } from "../hooks/use-mobile";
import { usePrimitives } from "../primitives/context";
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
  const primitives = usePrimitives();
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

  // Global keyboard navigation: Left/Right arrows trigger prev/next
  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || target.isContentEditable)
          return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onNext, onPrevious, canGoNext, canGoPrevious, isLoadingNext, runtime]);

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
    return (
      <div
        className="fl-rt-nav-mobile absolute bottom-0 left-0 right-0 z-[1000] bg-background/95 backdrop-blur-sm border-t border-border p-4 text-foreground"
        role="navigation"
      >
        <div className="flex items-center gap-3 max-w-sm mx-auto">
          <Button
            disabled={onPrevious ? !canGoPrevious : false}
            onClick={handlePrev}
            className="h-12 w-12 rounded-md border bg-background text-foreground hover:bg-accent disabled:opacity-100 disabled:text-muted-foreground disabled:border-border/70"
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
            className="flex-1 h-12 rounded-md bg-primary text-primary-foreground disabled:opacity-60 group"
            aria-label="Next"
          >
            <span>Continue</span>
            {!isLoadingNext && (
              <svg
                className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10.293 3.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {isLoadingNext && (
              <span className="ml-2 h-4 w-4 inline-block animate-spin border-b-2 border-primary-foreground rounded-full" />
            )}
          </Button>
        </div>
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

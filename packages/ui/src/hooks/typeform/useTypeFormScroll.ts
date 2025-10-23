"use client";

import { useEffect, useRef } from "react";

export interface UseTypeFormScrollProps {
  onNext: () => void;
  onPrevious: () => void;
  enabled?: boolean;
}

/**
 * useTypeFormScroll
 * - Wheel navigation helper for Typeform flows.
 * - Prevents default page scroll; allows native scroll inside elements that declare data-allow-scroll.
 */
export function useTypeFormScroll({
  onNext,
  onPrevious,
  enabled = true,
}: UseTypeFormScrollProps) {
  const isOverlayOpen = false; // consumer can gate externally if needed
  const lastScrollTime = useRef(0);
  const lastNavigationTime = useRef(0);
  const scrollAccumulator = useRef(0);
  const isNavigating = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleWheel = (e: WheelEvent) => {
      if (isOverlayOpen) return;

      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.closest &&
        target.closest('[data-allow-scroll="true"], [data-allow-scroll]')
      ) {
        return; // allow native scroll inside opt-in containers
      }

      e.preventDefault();

      const now = Date.now();
      const timeDiff = now - lastScrollTime.current;
      const navigationCooldown = now - lastNavigationTime.current;
      if (navigationCooldown < 500 || isNavigating.current) return;

      if (timeDiff > 800) scrollAccumulator.current = 0;

      let deltaY = e.deltaY;
      if (e.deltaMode === 1)
        deltaY *= 40; // line → px
      else if (e.deltaMode === 2) deltaY *= 800; // page → px

      scrollAccumulator.current += deltaY;
      lastScrollTime.current = now;

      const threshold = 250;
      if (Math.abs(scrollAccumulator.current) >= threshold) {
        isNavigating.current = true;
        lastNavigationTime.current = now;
        if (scrollAccumulator.current > 0) onNext();
        else onPrevious();
        scrollAccumulator.current = 0;
        setTimeout(() => {
          isNavigating.current = false;
        }, 100);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [onNext, onPrevious, enabled, isOverlayOpen]);
}

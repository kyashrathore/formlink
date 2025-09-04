"use client";

import { useEffect, useRef } from "react";

interface UseTypeFormScrollProps {
  onNext: () => void;
  onPrevious: () => void;
  enabled?: boolean;
}

export function useTypeFormScroll({
  onNext,
  onPrevious,
  enabled = true,
}: UseTypeFormScrollProps) {
  const isOverlayOpen = false;
  const lastScrollTime = useRef(0);
  const lastNavigationTime = useRef(0);
  const scrollAccumulator = useRef(0);
  const isNavigating = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleWheel = (e: WheelEvent) => {
      // Master switch: Do not navigate if an overlay is open
      if (isOverlayOpen) return;

      // Prevent default page scroll
      e.preventDefault();

      const now = Date.now();
      const timeDiff = now - lastScrollTime.current;
      const navigationCooldown = now - lastNavigationTime.current;

      if (navigationCooldown < 500 || isNavigating.current) return;

      if (timeDiff > 800) {
        scrollAccumulator.current = 0;
      }

      let deltaY = e.deltaY;
      if (e.deltaMode === 1) {
        deltaY *= 40;
      } else if (e.deltaMode === 2) {
        deltaY *= 800;
      }

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

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [onNext, onPrevious, enabled, isOverlayOpen]);
}

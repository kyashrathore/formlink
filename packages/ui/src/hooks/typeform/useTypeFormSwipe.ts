"use client";

import { useEffect, useRef } from "react";

export interface UseTypeFormSwipeProps {
  onNext: () => void;
  onPrevious: () => void;
  enabled?: boolean;
}

/**
 * useTypeFormSwipe
 * - Touch swipe (vertical) helper for Typeform flows.
 */
export function useTypeFormSwipe({
  onNext,
  onPrevious,
  enabled = true,
}: UseTypeFormSwipeProps) {
  const isOverlayOpen = false; // consumer can gate externally if needed
  const touchStartY = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (isOverlayOpen) return;
      if (e.touches.length > 0 && e.touches[0]) {
        touchStartY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isOverlayOpen) return;
      if (e.touches.length > 0 && e.touches[0]) {
        touchEndY.current = e.touches[0].clientY;
      }
    };

    const handleTouchEnd = () => {
      if (isOverlayOpen) return;
      if (!touchStartY.current || !touchEndY.current) return;
      const swipeDistance = touchStartY.current - touchEndY.current;
      const swipeThreshold = 50;
      if (Math.abs(swipeDistance) > swipeThreshold) {
        if (swipeDistance > 0) onNext();
        else onPrevious();
      }
      touchStartY.current = null;
      touchEndY.current = null;
    };

    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [onNext, onPrevious, enabled, isOverlayOpen]);
}

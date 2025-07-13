"use client";

import { useEffect, useRef } from "react";
import { useTypeFormDropdown } from "@formlink/ui";

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
  const { isDropdownOpen } = useTypeFormDropdown();
  const lastScrollTime = useRef(0);
  const lastNavigationTime = useRef(0);
  const scrollAccumulator = useRef(0);
  const isNavigating = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const handleWheel = (e: WheelEvent) => {
      // Don't prevent default if dropdown is open - allow normal scrolling
      if (!isDropdownOpen) {
        e.preventDefault();
      }
      
      const now = Date.now();
      const timeDiff = now - lastScrollTime.current;
      const navigationCooldown = now - lastNavigationTime.current;
      
      // Prevent navigation if dropdown is open
      if (isDropdownOpen) {
        return;
      }
      
      // Prevent navigation during cooldown period
      if (navigationCooldown < 500) {
        return;
      }
      
      // Prevent navigation while already navigating
      if (isNavigating.current) {
        return;
      }
      
      // Reset accumulator if enough time has passed
      if (timeDiff > 800) {
        scrollAccumulator.current = 0;
      }
      
      // Normalize wheel delta for different devices
      let deltaY = e.deltaY;
      if (e.deltaMode === 1) {
        // Line mode (Firefox)
        deltaY *= 40;
      } else if (e.deltaMode === 2) {
        // Page mode
        deltaY *= 800;
      }
      
      scrollAccumulator.current += deltaY;
      lastScrollTime.current = now;
      
      // Trigger navigation when threshold is reached
      const threshold = 250;
      if (Math.abs(scrollAccumulator.current) >= threshold) {
        isNavigating.current = true;
        lastNavigationTime.current = now;
        
        if (scrollAccumulator.current > 0) {
          onNext();
        } else {
          onPrevious();
        }
        
        scrollAccumulator.current = 0;
        
        // Reset navigation lock after a brief delay
        setTimeout(() => {
          isNavigating.current = false;
        }, 100);
      }
    };

    // Add passive: false to be able to preventDefault
    window.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
    };
  }, [onNext, onPrevious, enabled, isDropdownOpen]);
}
import { useEffect, useRef, useCallback, useState, RefObject } from "react";
import { FormMode } from "../form/context/FormModeContext";

interface UseFocusManagementOptions {
  mode: FormMode;
  elementRef?: RefObject<HTMLElement>;
  containerRef?: RefObject<HTMLElement>;
  autoFocus?: boolean;
  trapFocus?: boolean;
  restoreFocus?: boolean;
  focusOnError?: boolean;
  scrollToError?: boolean;
  keepFocusOnInteraction?: boolean;
  announceChanges?: boolean;
  trackHistory?: boolean;
  customTabOrder?: number[];
}

interface UseFocusManagementReturn {
  focusableElements: HTMLElement[];
  isFocusTrapped: boolean;
  focusHistory: HTMLElement[];
  handleKeyDown: (event: KeyboardEvent) => void;
  handleInteraction: () => void;
  saveFocus: () => void;
  restoreFocus: () => void;
  focusErrorField: (fieldId?: string) => void;
  applyTabOrder: () => void;
  resetTabOrder: () => void;
  announceFocusChange: (message: string) => void;
  handleSkipLink: (targetId: string) => void;
  recordFocus: () => void;
  focusPrevious: () => void;
  clearHistory: () => void;
}

const FOCUSABLE_SELECTORS = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useFocusManagement(
  options: UseFocusManagementOptions,
): UseFocusManagementReturn {
  const {
    mode,
    elementRef,
    containerRef,
    autoFocus = false,
    trapFocus = mode === "typeform",
    restoreFocus = false,
    scrollToError = false,
    keepFocusOnInteraction = mode === "ai",
    announceChanges = false,
    trackHistory = false,
    customTabOrder = [],
  } = options;

  const [focusableElements, setFocusableElements] = useState<HTMLElement[]>([]);
  const [focusHistory, setFocusHistory] = useState<HTMLElement[]>([]);
  const savedFocusRef = useRef<HTMLElement | null>(null);
  const historyIndexRef = useRef<number>(-1);

  // Get scroll behavior based on user preferences
  const getScrollBehavior = useCallback(() => {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    return prefersReducedMotion ? "auto" : "smooth";
  }, []);

  // Update focusable elements when container changes
  useEffect(() => {
    if (containerRef?.current && trapFocus) {
      const elements = Array.from(
        containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS),
      ) as HTMLElement[];
      setFocusableElements(elements);
    }
  }, [containerRef, trapFocus]);

  // Auto focus on mount
  useEffect(() => {
    if (autoFocus && elementRef?.current) {
      // Small delay to ensure DOM is ready
      const timeoutId = setTimeout(() => {
        elementRef.current?.focus();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [autoFocus, elementRef]);

  // Save initial focus for restoration
  useEffect(() => {
    if (restoreFocus) {
      savedFocusRef.current = document.activeElement as HTMLElement;

      return () => {
        // Restore focus on unmount
        if (savedFocusRef.current && savedFocusRef.current !== document.body) {
          savedFocusRef.current.focus();
        }
      };
    }
  }, [restoreFocus]);

  // Handle keyboard navigation for focus trapping
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!trapFocus || !containerRef?.current || event.key !== "Tab") {
        return;
      }

      const focusable = Array.from(
        containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS),
      ) as HTMLElement[];

      if (focusable.length === 0) return;

      const currentIndex = focusable.indexOf(
        document.activeElement as HTMLElement,
      );
      let nextIndex: number;

      if (event.shiftKey) {
        // Backward navigation
        nextIndex = currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1;
      } else {
        // Forward navigation
        nextIndex = currentIndex >= focusable.length - 1 ? 0 : currentIndex + 1;
      }

      event.preventDefault();
      focusable[nextIndex].focus();
    },
    [trapFocus, containerRef],
  );

  // Handle interaction in chat mode
  const handleInteraction = useCallback(() => {
    if (keepFocusOnInteraction && elementRef?.current) {
      elementRef.current.focus();
    }
  }, [keepFocusOnInteraction, elementRef]);

  // Save current focus
  const saveFocus = useCallback(() => {
    savedFocusRef.current = document.activeElement as HTMLElement;
  }, []);

  // Restore saved focus
  const restoreSavedFocus = useCallback(() => {
    if (savedFocusRef.current && savedFocusRef.current !== document.body) {
      savedFocusRef.current.focus();
    }
  }, []);

  // Focus on error field
  const focusErrorField = useCallback(
    (fieldId?: string) => {
      let errorField: HTMLElement | null = null;

      if (fieldId) {
        errorField = document.getElementById(fieldId);
      } else {
        // Find first field with aria-invalid="true"
        errorField = document.querySelector('[aria-invalid="true"]');
      }

      if (errorField) {
        if (scrollToError) {
          errorField.scrollIntoView({
            behavior: getScrollBehavior() as ScrollBehavior,
            block: "center",
          });
        }
        errorField.focus();
      }
    },
    [scrollToError, getScrollBehavior],
  );

  // Apply custom tab order
  const applyTabOrder = useCallback(() => {
    if (!containerRef?.current) return;

    const elements = Array.from(
      containerRef.current.querySelectorAll(FOCUSABLE_SELECTORS),
    ) as HTMLElement[];

    if (customTabOrder.length > 0) {
      // Create a mapping of original index to custom order
      customTabOrder.forEach((targetIndex, currentIndex) => {
        if (elements[targetIndex]) {
          elements[targetIndex].setAttribute(
            "tabindex",
            String(currentIndex + 1),
          );
        }
      });
    } else {
      // Default tab order
      elements.forEach((element, index) => {
        element.setAttribute("tabindex", String(index + 1));
      });
    }
  }, [containerRef, customTabOrder]);

  // Reset tab order
  const resetTabOrder = useCallback(() => {
    if (!containerRef?.current) return;

    const elements = Array.from(
      containerRef.current.querySelectorAll("[tabindex]"),
    ) as HTMLElement[];

    elements.forEach((element) => {
      element.removeAttribute("tabindex");
    });
  }, [containerRef]);

  // Announce focus changes for screen readers
  const announceFocusChange = useCallback(
    (message: string) => {
      if (!announceChanges) return;

      // Use existing live region or create one
      let liveRegion = document.getElementById("focus-announcer");
      if (!liveRegion) {
        liveRegion = document.createElement("div");
        liveRegion.id = "focus-announcer";
        liveRegion.setAttribute("aria-live", "polite");
        liveRegion.setAttribute("aria-atomic", "true");
        liveRegion.style.position = "absolute";
        liveRegion.style.left = "-10000px";
        liveRegion.style.width = "1px";
        liveRegion.style.height = "1px";
        liveRegion.style.overflow = "hidden";
        document.body.appendChild(liveRegion);
      }

      liveRegion.textContent = message;
    },
    [announceChanges],
  );

  // Handle skip links
  const handleSkipLink = useCallback((targetId: string) => {
    const target = document.getElementById(targetId);
    if (target) {
      target.focus();
      target.setAttribute("tabindex", "-1");
    }
  }, []);

  // Record focus in history
  const recordFocus = useCallback(() => {
    if (!trackHistory) return;

    const currentElement = document.activeElement as HTMLElement;
    if (currentElement && currentElement !== document.body) {
      setFocusHistory((prev) => [...prev, currentElement]);
      historyIndexRef.current = focusHistory.length;
    }
  }, [trackHistory, focusHistory.length]);

  // Navigate to previous focus in history
  const focusPrevious = useCallback(() => {
    if (!trackHistory || focusHistory.length === 0) return;

    const newIndex = Math.max(0, historyIndexRef.current - 1);
    if (newIndex !== historyIndexRef.current && focusHistory[newIndex]) {
      historyIndexRef.current = newIndex;
      focusHistory[newIndex].focus();
    }
  }, [trackHistory, focusHistory]);

  // Clear focus history
  const clearHistory = useCallback(() => {
    setFocusHistory([]);
    historyIndexRef.current = -1;
  }, []);

  // Add event listeners
  useEffect(() => {
    if (trapFocus && containerRef?.current) {
      const container = containerRef.current;
      container.addEventListener("keydown", handleKeyDown as any);

      return () => {
        container.removeEventListener("keydown", handleKeyDown as any);
      };
    }
  }, [trapFocus, containerRef, handleKeyDown]);

  return {
    focusableElements,
    isFocusTrapped: trapFocus,
    focusHistory,
    handleKeyDown,
    handleInteraction,
    saveFocus,
    restoreFocus: restoreSavedFocus,
    focusErrorField,
    applyTabOrder,
    resetTabOrder,
    announceFocusChange,
    handleSkipLink,
    recordFocus,
    focusPrevious,
    clearHistory,
  };
}

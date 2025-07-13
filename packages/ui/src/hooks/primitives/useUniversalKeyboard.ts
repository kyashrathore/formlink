"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useTypeFormDropdown } from "../../form/context/TypeFormDropdownContext";

/**
 * Configuration for keyboard navigation behavior
 */
export interface KeyboardConfig {
  /** Keyboard shortcuts configuration */
  shortcuts: {
    /** Enable A-Z letter selection for options */
    letters: boolean;
    /** Enable 1-9 number selection for options */
    numbers: boolean;
    /** Enable arrow key navigation (up/down) */
    arrows: boolean;
    /** Enable vim-style navigation (j/k) */
    vim: boolean;
  };
  /** Conflict resolution settings */
  conflicts: {
    /** Prevent page scroll when using arrow keys */
    preventScroll: boolean;
    /** Prevent form navigation (e.g., Enter submitting form) */
    preventFormNav: boolean;
  };
}

/**
 * Option interface for selectable items
 */
export interface Option<T = unknown> {
  /** The value to be selected */
  value: T;
  /** Display label for the option */
  label: string;
  /** Whether this option is disabled */
  disabled?: boolean;
}

/**
 * Parameters for the useUniversalKeyboard hook
 */
interface UseUniversalKeyboardParams<T> {
  /** Keyboard navigation configuration */
  config: KeyboardConfig;
  /** Array of selectable options */
  options: Option<T>[];
  /** Callback when an option is selected */
  onSelect: (option: Option<T>) => void;
  /** Optional callback when highlight changes */
  onHighlight?: (index: number) => void;
  /** Whether keyboard navigation is currently active */
  isActive?: boolean;
  /** Whether to auto-focus the container on mount */
  autoFocus?: boolean;
}

/**
 * Universal keyboard navigation hook for accessible form inputs
 * 
 * @description
 * Provides comprehensive keyboard navigation for any list of options,
 * supporting multiple navigation patterns (arrows, letters, numbers, vim).
 * Handles focus management, ARIA attributes, and conflict resolution.
 * 
 * @example
 * ```typescript
 * const keyboard = useUniversalKeyboard({
 *   config: {
 *     shortcuts: { letters: true, numbers: true, arrows: true },
 *     conflicts: { preventScroll: true }
 *   },
 *   options: myOptions,
 *   onSelect: handleSelection,
 *   isActive: true
 * });
 * 
 * return (
 *   <div {...keyboard.getContainerProps()}>
 *     {options.map((opt, i) => (
 *       <div {...keyboard.getOptionProps(i)}>{opt.label}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useUniversalKeyboard<T>({
  config,
  options,
  onSelect,
  onHighlight,
  isActive = true,
  autoFocus = false,
}: UseUniversalKeyboardParams<T>) {
  const { isDropdownOpen, setDropdownOpen } = useTypeFormDropdown();
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const activeOptions = options.filter((opt) => !opt.disabled);

  // Update parent when highlight changes
  useEffect(() => {
    onHighlight?.(highlightedIndex);
  }, [highlightedIndex, onHighlight]);

  // Reset highlight when options change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [options]);

  // Auto-focus container if needed
  useEffect(() => {
    if (autoFocus && containerRef.current && isActive) {
      containerRef.current.focus();
    }
  }, [autoFocus, isActive]);

  const findOptionByLetter = useCallback(
    (letter: string): Option<T> | undefined => {
      const normalizedLetter = letter.toLowerCase();
      return activeOptions.find((option) =>
        option.label.toLowerCase().startsWith(normalizedLetter)
      );
    },
    [activeOptions]
  );

  const selectHighlighted = useCallback(() => {
    const option = activeOptions[highlightedIndex];
    if (option) {
      onSelect(option);
      setDropdownOpen(false);
    }
  }, [activeOptions, highlightedIndex, onSelect, setDropdownOpen]);

  const closeDropdown = useCallback(() => {
    setDropdownOpen(false);
  }, [setDropdownOpen]);

  const moveHighlight = useCallback(
    (direction: "up" | "down") => {
      setHighlightedIndex((prev) => {
        if (direction === "down") {
          return prev < activeOptions.length - 1 ? prev + 1 : prev;
        } else {
          return prev > 0 ? prev - 1 : prev;
        }
      });
    },
    [activeOptions.length]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent | KeyboardEvent) => {
      if (!isActive) return;

      // Priority 1: Component state (dropdown open)
      if (isDropdownOpen) {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            if (config.conflicts.preventScroll) e.stopPropagation();
            moveHighlight("down");
            break;

          case "ArrowUp":
            e.preventDefault();
            if (config.conflicts.preventScroll) e.stopPropagation();
            moveHighlight("up");
            break;

          case "j":
            if (config.shortcuts.vim) {
              e.preventDefault();
              if (config.conflicts.preventScroll) e.stopPropagation();
              moveHighlight("down");
            }
            break;

          case "k":
            if (config.shortcuts.vim) {
              e.preventDefault();
              if (config.conflicts.preventScroll) e.stopPropagation();
              moveHighlight("up");
            }
            break;

          case "Enter":
            e.preventDefault();
            if (config.conflicts.preventFormNav) e.stopPropagation();
            selectHighlighted();
            break;

          case "Escape":
            e.preventDefault();
            closeDropdown();
            break;

          case " ": // Space key
            e.preventDefault();
            if (config.conflicts.preventFormNav) e.stopPropagation();
            selectHighlighted();
            break;
        }
        return;
      }

      // Priority 2: Shortcuts (when dropdown is closed)
      
      // Letter shortcuts
      if (config.shortcuts.letters && /^[a-zA-Z]$/.test(e.key)) {
        const option = findOptionByLetter(e.key);
        if (option) {
          e.preventDefault();
          if (config.conflicts.preventFormNav) e.stopPropagation();
          onSelect(option);
          return;
        }
      }

      // Number shortcuts
      if (config.shortcuts.numbers && /^[1-9]$/.test(e.key)) {
        const index = parseInt(e.key) - 1;
        const option = activeOptions[index];
        if (option) {
          e.preventDefault();
          if (config.conflicts.preventFormNav) e.stopPropagation();
          onSelect(option);
          return;
        }
      }

      // Arrow navigation when closed (optional)
      if (config.shortcuts.arrows && !isDropdownOpen) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (config.conflicts.preventScroll) e.stopPropagation();
          setDropdownOpen(true);
        }
      }
    },
    [
      isActive,
      isDropdownOpen,
      config,
      moveHighlight,
      selectHighlighted,
      closeDropdown,
      findOptionByLetter,
      activeOptions,
      onSelect,
      setDropdownOpen,
    ]
  );

  // Component-level event handling
  const getContainerProps = useCallback(() => {
    return {
      ref: containerRef,
      onKeyDown: handleKeyDown,
      tabIndex: isActive ? 0 : -1,
      role: "listbox",
      "aria-activedescendant": activeOptions[highlightedIndex]?.value
        ? `option-${activeOptions[highlightedIndex].value}`
        : undefined,
      // Ensure container can receive focus
      onFocus: () => {
        // Auto-focus behavior when container receives focus
        if (isActive && autoFocus && !isDropdownOpen) {
          // Only open dropdown if it's not already open
          setDropdownOpen(true);
        }
      },
      // Better keyboard capture
      onKeyDownCapture: handleKeyDown,
    };
  }, [handleKeyDown, isActive, activeOptions, highlightedIndex, autoFocus, isDropdownOpen, setDropdownOpen]);

  const getOptionProps = useCallback(
    (index: number) => {
      const option = activeOptions[index];
      const isHighlighted = index === highlightedIndex;
      const isSelected = false; // This should be passed from parent if needed

      return {
        id: `option-${option.value}`,
        role: "option",
        "aria-selected": isSelected,
        "aria-disabled": option.disabled,
        tabIndex: -1,
        onMouseEnter: () => setHighlightedIndex(index),
        onClick: () => {
          if (!option.disabled) {
            onSelect(option);
          }
        },
        "data-highlighted": isHighlighted,
      };
    },
    [activeOptions, highlightedIndex, onSelect]
  );

  // Cleanup
  useEffect(() => {
    if (!isActive) return;

    // Add global listener for accessibility
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Only handle if our container has focus or contains the focused element
      if (
        containerRef.current &&
        (containerRef.current.contains(document.activeElement) ||
         document.activeElement === containerRef.current)
      ) {
        handleKeyDown(e);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown, true);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown, true);
  }, [isActive, handleKeyDown]);

  return {
    highlightedIndex,
    handleKeyDown,
    getContainerProps,
    getOptionProps,
    isDropdownOpen,
    setDropdownOpen,
    containerRef,
  };
}

// Utility function to determine if options should be directly rendered
export function shouldDirectRender(
  options: Option[],
  mode: "typeform" | "chat",
  override?: boolean
): boolean {
  if (override !== undefined) return override;
  if (mode === "chat") return false; // Space constraints in chat mode
  if (options.length > 10) return false; // Need search for many options
  if (options.length <= 6) return true; // Direct render for few options
  return false; // Default to not direct rendering
}
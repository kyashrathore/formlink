"use client";

import { useCallback, useEffect, useState, useRef } from "react";

/**
 * Option interface for selectable items
 */
export interface NavigationOption<T = unknown> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * Parameters for the useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationParams<T> {
  /** Current form mode (chat or typeform) */
  mode: "chat" | "typeform";
  /** Array of selectable options */
  options: NavigationOption<T>[];
  /** Whether keyboard navigation is currently active */
  isActive?: boolean;
  /** Initial highlighted index */
  initialHighlightedIndex?: number;
  /** Callback when an option is selected */
  onSelect?: (option: NavigationOption<T>) => void;
  /** Callback when highlight changes */
  onHighlight?: (index: number) => void;
  /** Callback when cancel/escape is pressed */
  onCancel?: () => void;
  /** Callback to focus next element */
  onFocusNext?: () => void;
  /** Callback to focus previous element */
  onFocusPrevious?: () => void;
  /** Custom key handler - return true to prevent default handling */
  onCustomKeyDown?: (event: KeyboardEvent | React.KeyboardEvent) => boolean;
  /** Enable wrapping around when reaching boundaries */
  wrapAround?: boolean;
  /** Close/reset on escape */
  closeOnEscape?: boolean;
  /** Enable focus trap */
  focusTrap?: boolean;
  /** Prevent form navigation (Enter submitting form) */
  preventFormNav?: boolean;
  /** Enable letter shortcuts (typeform mode) */
  enableLetterShortcuts?: boolean;
  /** Enable number shortcuts (typeform mode) */
  enableNumberShortcuts?: boolean;
  /** Enable vim-style navigation (j/k) in typeform mode */
  enableVimKeys?: boolean;
  /** ARIA label for the container */
  ariaLabel?: string;
  /** Whether to announce changes to screen readers */
  announceChanges?: boolean;
}

/**
 * Return type for the useKeyboardNavigation hook
 */
export interface UseKeyboardNavigationReturn<T> {
  /** Currently highlighted index */
  highlightedIndex: number;
  /** Set highlighted index manually */
  setHighlightedIndex: (index: number) => void;
  /** Handle keyboard events */
  handleKeyDown: (event: KeyboardEvent | React.KeyboardEvent) => void;
  /** Get container props for accessibility */
  getContainerProps: () => React.HTMLAttributes<HTMLElement>;
  /** Get option props for accessibility */
  getOptionProps: (index: number) => React.HTMLAttributes<HTMLElement>;
  /** Current announcement for screen readers */
  announcement: string;
}

/**
 * Mode-aware keyboard navigation hook
 * 
 * @description
 * Provides comprehensive keyboard navigation with mode-specific behaviors.
 * Chat mode focuses on simplicity and accessibility, while TypeForm mode
 * includes advanced shortcuts and navigation patterns.
 * 
 * @example
 * ```typescript
 * const navigation = useKeyboardNavigation({
 *   mode: 'chat',
 *   options: myOptions,
 *   onSelect: handleSelection,
 *   isActive: true
 * });
 * 
 * return (
 *   <div {...navigation.getContainerProps()}>
 *     {options.map((opt, i) => (
 *       <div {...navigation.getOptionProps(i)}>{opt.label}</div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useKeyboardNavigation<T>({
  mode,
  options,
  isActive = true,
  initialHighlightedIndex = 0,
  onSelect,
  onHighlight,
  onCancel,
  onFocusNext,
  onFocusPrevious,
  onCustomKeyDown,
  wrapAround = false,
  closeOnEscape = false,
  focusTrap = false,
  preventFormNav = false,
  enableLetterShortcuts = false,
  enableNumberShortcuts = false,
  enableVimKeys = false,
  ariaLabel,
  announceChanges = false,
}: UseKeyboardNavigationParams<T>): UseKeyboardNavigationReturn<T> {
  const [highlightedIndex, setHighlightedIndexState] = useState(initialHighlightedIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const isFirstRender = useRef(true);
  
  // Filter out disabled options for navigation
  const activeOptions = options.filter(opt => !opt.disabled);
  const activeIndices = options
    .map((opt, idx) => (!opt.disabled ? idx : null))
    .filter((idx): idx is number => idx !== null);

  // Update parent when highlight changes
  useEffect(() => {
    if (isActive && !isFirstRender.current) {
      onHighlight?.(highlightedIndex);
    }
    isFirstRender.current = false;
  }, [highlightedIndex, onHighlight, isActive]);

  // Get announcement text for screen readers
  const getAnnouncement = useCallback((index: number): string => {
    const option = options[index];
    if (!option) return "";
    
    // Count total non-disabled options
    const total = options.filter(opt => !opt.disabled).length;
    const position = activeIndices.indexOf(index) + 1;
    return `${option.label}, ${position} of ${total}`;
  }, [options, activeIndices]);

  const announcement = announceChanges ? getAnnouncement(highlightedIndex) : "";

  // Find next/previous non-disabled index
  const findNextIndex = useCallback((currentIndex: number, direction: "up" | "down"): number => {
    const currentActiveIdx = activeIndices.indexOf(currentIndex);
    if (currentActiveIdx === -1) return activeIndices[0] || 0;

    let nextActiveIdx: number;
    if (direction === "down") {
      nextActiveIdx = currentActiveIdx + 1;
      if (nextActiveIdx >= activeIndices.length) {
        return wrapAround ? activeIndices[0] : currentIndex;
      }
    } else {
      nextActiveIdx = currentActiveIdx - 1;
      if (nextActiveIdx < 0) {
        return wrapAround ? activeIndices[activeIndices.length - 1] : currentIndex;
      }
    }
    
    return activeIndices[nextActiveIdx];
  }, [activeIndices, wrapAround]);

  // Move highlight
  const moveHighlight = useCallback((direction: "up" | "down") => {
    setHighlightedIndexState(prev => findNextIndex(prev, direction));
  }, [findNextIndex]);

  // Set highlighted index with validation
  const setHighlightedIndex = useCallback((index: number) => {
    // Ensure we're setting a valid, non-disabled index
    if (options[index] && !options[index].disabled) {
      setHighlightedIndexState(index);
    }
  }, [options]);

  // Find option by letter
  const findOptionByLetter = useCallback((letter: string): { option: NavigationOption<T>; index: number } | undefined => {
    const normalizedLetter = letter.toLowerCase();
    const index = options.findIndex(option => 
      !option.disabled && option.label.toLowerCase().startsWith(normalizedLetter)
    );
    
    return index !== -1 ? { option: options[index], index } : undefined;
  }, [options]);

  // Handle key down events
  const handleKeyDown = useCallback((event: KeyboardEvent | React.KeyboardEvent) => {
    if (!isActive) return;

    // Custom handler first
    if (onCustomKeyDown && onCustomKeyDown(event)) {
      return;
    }

    const { key, shiftKey } = event;

    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        moveHighlight("down");
        break;

      case "ArrowUp":
        event.preventDefault();
        moveHighlight("up");
        break;

      case "Home":
        event.preventDefault();
        setHighlightedIndex(activeIndices[0] || 0);
        break;

      case "End":
        event.preventDefault();
        setHighlightedIndex(activeIndices[activeIndices.length - 1] || 0);
        break;

      case "Enter":
      case " ": // Space
        {
          const currentOption = options[highlightedIndex];
          if (currentOption && !currentOption.disabled && onSelect) {
            event.preventDefault();
            if (preventFormNav) event.stopPropagation();
            onSelect(currentOption);
          }
        }
        break;

      case "Escape":
        event.preventDefault();
        if (onCancel) onCancel();
        if (closeOnEscape) setHighlightedIndex(0);
        break;

      case "Tab":
        if (focusTrap) {
          event.preventDefault();
          if (shiftKey) {
            // Move to previous or wrap to end
            const newIndex = findNextIndex(highlightedIndex, "up");
            if (newIndex === highlightedIndex) {
              // We're at the beginning, wrap to end
              setHighlightedIndex(activeIndices[activeIndices.length - 1]);
            } else {
              setHighlightedIndex(newIndex);
            }
          } else {
            // Move to next or wrap to beginning
            const newIndex = findNextIndex(highlightedIndex, "down");
            if (newIndex === highlightedIndex) {
              // We're at the end, wrap to beginning
              setHighlightedIndex(activeIndices[0]);
            } else {
              setHighlightedIndex(newIndex);
            }
          }
        } else {
          // Let Tab work normally but call callbacks
          if (shiftKey && onFocusPrevious) {
            onFocusPrevious();
          } else if (!shiftKey && onFocusNext) {
            onFocusNext();
          }
        }
        break;

      default:
        // Mode-specific shortcuts
        if (mode === "typeform") {
          // Vim-style navigation
          if (enableVimKeys) {
            if (key === "j") {
              event.preventDefault();
              moveHighlight("down");
              return;
            } else if (key === "k") {
              event.preventDefault();
              moveHighlight("up");
              return;
            }
          }

          // Letter shortcuts
          if (enableLetterShortcuts && /^[a-zA-Z]$/.test(key)) {
            const result = findOptionByLetter(key);
            if (result && onSelect) {
              event.preventDefault();
              if (preventFormNav) event.stopPropagation();
              onSelect(result.option);
              return;
            }
          }

          // Number shortcuts
          if (enableNumberShortcuts && /^[1-9]$/.test(key)) {
            const index = parseInt(key) - 1;
            const option = activeOptions[index];
            if (option && onSelect) {
              event.preventDefault();
              if (preventFormNav) event.stopPropagation();
              onSelect(option);
              return;
            }
          }
        }
        break;
    }
  }, [
    isActive,
    onCustomKeyDown,
    mode,
    options,
    highlightedIndex,
    onSelect,
    preventFormNav,
    onCancel,
    closeOnEscape,
    focusTrap,
    onFocusPrevious,
    onFocusNext,
    enableVimKeys,
    enableLetterShortcuts,
    enableNumberShortcuts,
    moveHighlight,
    setHighlightedIndex,
    findOptionByLetter,
    activeOptions,
    activeIndices,
    findNextIndex,
    wrapAround,
  ]);

  // Get container props
  const getContainerProps = useCallback((): React.HTMLAttributes<HTMLElement> => {
    return {
      ref: containerRef as any,
      role: "listbox",
      "aria-label": ariaLabel,
      "aria-activedescendant": options[highlightedIndex]?.value 
        ? `option-${options[highlightedIndex].value}`
        : undefined,
      tabIndex: isActive ? 0 : -1,
      onKeyDown: handleKeyDown as any,
    };
  }, [ariaLabel, options, highlightedIndex, isActive, handleKeyDown]);

  // Get option props
  const getOptionProps = useCallback((index: number): React.HTMLAttributes<HTMLElement> => {
    const option = options[index];
    const isHighlighted = index === highlightedIndex;

    return {
      id: `option-${option.value}`,
      role: "option",
      "aria-selected": isHighlighted,
      "aria-disabled": option.disabled,
      onMouseEnter: () => setHighlightedIndex(index),
      onClick: () => {
        if (!option.disabled && onSelect) {
          onSelect(option);
        }
      },
    };
  }, [options, highlightedIndex, setHighlightedIndex, onSelect]);

  return {
    highlightedIndex,
    setHighlightedIndex,
    handleKeyDown,
    getContainerProps,
    getOptionProps,
    announcement,
  };
}
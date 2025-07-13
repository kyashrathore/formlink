import { useState, useCallback, useEffect, useRef } from 'react';

export interface KeyboardConfig {
  /**
   * Enable letter shortcuts (A-Z)
   */
  enableLetters?: boolean;
  
  /**
   * Enable number shortcuts (1-9)
   */
  enableNumbers?: boolean;
  
  /**
   * Enable arrow key navigation
   */
  enableArrows?: boolean;
  
  /**
   * Enable vim-style navigation (j/k)
   */
  enableVim?: boolean;
  
  /**
   * Enable home/end keys
   */
  enableHomeEnd?: boolean;
  
  /**
   * Enable page up/down keys
   */
  enablePageKeys?: boolean;
  
  /**
   * Whether to wrap around at the ends
   */
  wrapAround?: boolean;
  
  /**
   * Prevent default scroll behavior
   */
  preventScroll?: boolean;
  
  /**
   * Prevent form navigation (Enter to submit)
   */
  preventFormNav?: boolean;
}

export interface UseKeyboardNavReturn {
  /**
   * Current highlighted index
   */
  highlightedIndex: number;
  
  /**
   * Set highlighted index
   */
  setHighlightedIndex: (index: number) => void;
  
  /**
   * Handle keyboard event
   */
  handleKeyDown: (event: React.KeyboardEvent) => void;
  
  /**
   * Whether navigation is active
   */
  isNavigating: boolean;
  
  /**
   * Reset navigation state
   */
  resetNavigation: () => void;
  
  /**
   * Navigate to next item
   */
  navigateNext: () => void;
  
  /**
   * Navigate to previous item
   */
  navigatePrevious: () => void;
  
  /**
   * Navigate to first item
   */
  navigateFirst: () => void;
  
  /**
   * Navigate to last item
   */
  navigateLast: () => void;
  
  /**
   * Navigate by offset
   */
  navigateBy: (offset: number) => void;
}

export function useKeyboardNav(
  itemCount: number,
  config: KeyboardConfig = {},
  onSelect?: (index: number) => void,
  onCancel?: () => void
): UseKeyboardNavReturn {
  const {
    enableLetters = true,
    enableNumbers = true,
    enableArrows = true,
    enableVim = false,
    enableHomeEnd = true,
    enablePageKeys = false,
    wrapAround = true,
    preventScroll = true,
    preventFormNav = false,
  } = config;

  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigationTimeoutRef = useRef<NodeJS.Timeout>();

  // Reset navigation after inactivity
  useEffect(() => {
    if (isNavigating) {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
      
      navigationTimeoutRef.current = setTimeout(() => {
        setIsNavigating(false);
      }, 3000); // Reset after 3 seconds of inactivity
    }
    
    return () => {
      if (navigationTimeoutRef.current) {
        clearTimeout(navigationTimeoutRef.current);
      }
    };
  }, [isNavigating, highlightedIndex]);

  const updateHighlightedIndex = useCallback((newIndex: number) => {
    if (itemCount === 0) return;
    
    let finalIndex = newIndex;
    
    if (wrapAround) {
      if (newIndex < 0) {
        finalIndex = itemCount - 1;
      } else if (newIndex >= itemCount) {
        finalIndex = 0;
      }
    } else {
      finalIndex = Math.max(0, Math.min(itemCount - 1, newIndex));
    }
    
    setHighlightedIndex(finalIndex);
    setIsNavigating(true);
  }, [itemCount, wrapAround]);

  const navigateNext = useCallback(() => {
    updateHighlightedIndex(highlightedIndex + 1);
  }, [highlightedIndex, updateHighlightedIndex]);

  const navigatePrevious = useCallback(() => {
    updateHighlightedIndex(highlightedIndex - 1);
  }, [highlightedIndex, updateHighlightedIndex]);

  const navigateFirst = useCallback(() => {
    updateHighlightedIndex(0);
  }, [updateHighlightedIndex]);

  const navigateLast = useCallback(() => {
    updateHighlightedIndex(itemCount - 1);
  }, [itemCount, updateHighlightedIndex]);

  const navigateBy = useCallback((offset: number) => {
    updateHighlightedIndex(highlightedIndex + offset);
  }, [highlightedIndex, updateHighlightedIndex]);

  const resetNavigation = useCallback(() => {
    setHighlightedIndex(-1);
    setIsNavigating(false);
    if (navigationTimeoutRef.current) {
      clearTimeout(navigationTimeoutRef.current);
    }
  }, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    let handled = false;

    // Arrow navigation
    if (enableArrows) {
      switch (event.key) {
        case 'ArrowDown':
          if (preventScroll) event.preventDefault();
          navigateNext();
          handled = true;
          break;
          
        case 'ArrowUp':
          if (preventScroll) event.preventDefault();
          navigatePrevious();
          handled = true;
          break;
          
        case 'ArrowRight':
          if (event.currentTarget.getAttribute('role') === 'radiogroup' ||
              event.currentTarget.getAttribute('role') === 'tablist') {
            event.preventDefault();
            navigateNext();
            handled = true;
          }
          break;
          
        case 'ArrowLeft':
          if (event.currentTarget.getAttribute('role') === 'radiogroup' ||
              event.currentTarget.getAttribute('role') === 'tablist') {
            event.preventDefault();
            navigatePrevious();
            handled = true;
          }
          break;
      }
    }

    // Vim navigation
    if (enableVim && !event.ctrlKey && !event.metaKey && !event.altKey) {
      switch (event.key) {
        case 'j':
          event.preventDefault();
          navigateNext();
          handled = true;
          break;
          
        case 'k':
          event.preventDefault();
          navigatePrevious();
          handled = true;
          break;
          
        case 'g':
          if (event.shiftKey) {
            event.preventDefault();
            navigateLast();
            handled = true;
          } else {
            event.preventDefault();
            navigateFirst();
            handled = true;
          }
          break;
      }
    }

    // Home/End navigation
    if (enableHomeEnd) {
      switch (event.key) {
        case 'Home':
          event.preventDefault();
          navigateFirst();
          handled = true;
          break;
          
        case 'End':
          event.preventDefault();
          navigateLast();
          handled = true;
          break;
      }
    }

    // Page navigation
    if (enablePageKeys) {
      const pageSize = Math.max(1, Math.floor(itemCount / 10));
      
      switch (event.key) {
        case 'PageDown':
          event.preventDefault();
          navigateBy(pageSize);
          handled = true;
          break;
          
        case 'PageUp':
          event.preventDefault();
          navigateBy(-pageSize);
          handled = true;
          break;
      }
    }

    // Selection
    switch (event.key) {
      case 'Enter':
        if (highlightedIndex >= 0 && onSelect) {
          if (preventFormNav) event.preventDefault();
          onSelect(highlightedIndex);
          handled = true;
        }
        break;
        
      case ' ':
        if (highlightedIndex >= 0 && onSelect) {
          event.preventDefault();
          onSelect(highlightedIndex);
          handled = true;
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        resetNavigation();
        onCancel?.();
        handled = true;
        break;
    }

    // Letter shortcuts
    if (enableLetters && !handled && /^[a-zA-Z]$/.test(event.key)) {
      const letter = event.key.toLowerCase();
      // This would need to be implemented by the parent component
      // as it requires knowledge of the items
      event.preventDefault();
    }

    // Number shortcuts
    if (enableNumbers && !handled && /^[1-9]$/.test(event.key)) {
      const index = parseInt(event.key) - 1;
      if (index < itemCount) {
        event.preventDefault();
        setHighlightedIndex(index);
        onSelect?.(index);
        handled = true;
      }
    }
  }, [
    enableArrows,
    enableVim,
    enableHomeEnd,
    enablePageKeys,
    enableLetters,
    enableNumbers,
    preventScroll,
    preventFormNav,
    itemCount,
    highlightedIndex,
    navigateNext,
    navigatePrevious,
    navigateFirst,
    navigateLast,
    navigateBy,
    resetNavigation,
    onSelect,
    onCancel,
  ]);

  return {
    highlightedIndex,
    setHighlightedIndex: updateHighlightedIndex,
    handleKeyDown,
    isNavigating,
    resetNavigation,
    navigateNext,
    navigatePrevious,
    navigateFirst,
    navigateLast,
    navigateBy,
  };
}
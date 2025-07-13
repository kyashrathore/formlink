import { renderHook, act } from '@testing-library/react';
import { useKeyboardNav } from '../useKeyboardNav';

describe('useKeyboardNav', () => {
  describe('List Navigation', () => {
    it('navigates through items with arrow keys', () => {
      const onSelect = jest.fn();
      
      const { result } = renderHook(() => 
        useKeyboardNav(3, {}, onSelect)
      );
      
      expect(result.current.highlightedIndex).toBe(-1); // Initially -1
      
      // Arrow down
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'ArrowDown' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
      
      // Arrow down again
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'ArrowDown' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(1);
      
      // Arrow up
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'ArrowUp' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
    });

    it('wraps navigation at boundaries', () => {
      const { result } = renderHook(() => 
        useKeyboardNav(3, { wrapAround: true }, jest.fn())
      );
      
      // Start at -1, arrow up should go to last item (2)
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'ArrowUp' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(2);
      
      // Arrow down from last item should go to first
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'ArrowDown' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
    });

    it('stops at boundaries when wrap is false', () => {
      const { result } = renderHook(() => 
        useKeyboardNav(3, { wrapAround: false }, jest.fn())
      );
      
      // Start at -1, arrow up should go to 0 (first item)
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'ArrowUp' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
      
      // Arrow up again should stay at 0
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'ArrowUp' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
      
      // Go to last item
      act(() => {
        result.current.setHighlightedIndex(2);
      });
      
      // Arrow down from last item should stay at last
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'ArrowDown' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(2);
    });

    it('selects item with Enter key', () => {
      const onSelect = jest.fn();
      
      const { result } = renderHook(() => 
        useKeyboardNav(3, {}, onSelect)
      );
      
      // Set index to 1
      act(() => {
        result.current.setHighlightedIndex(1);
      });
      
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'Enter' }) as any
        );
      });
      
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('selects item with Space key', () => {
      const onSelect = jest.fn();
      
      const { result } = renderHook(() => 
        useKeyboardNav(3, {}, onSelect)
      );
      
      // Set index to 0
      act(() => {
        result.current.setHighlightedIndex(0);
      });
      
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: ' ' }) as any
        );
      });
      
      expect(onSelect).toHaveBeenCalledWith(0);
    });

    it('calls onCancel with Escape key', () => {
      const onCancel = jest.fn();
      
      const { result } = renderHook(() => 
        useKeyboardNav(3, {}, jest.fn(), onCancel)
      );
      
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'Escape' }) as any
        );
      });
      
      expect(onCancel).toHaveBeenCalled();
      expect(result.current.highlightedIndex).toBe(-1); // Reset to -1
    });
  });

  describe('Navigation Methods', () => {
    it('navigates using navigation methods', () => {
      const { result } = renderHook(() => 
        useKeyboardNav(5, {}, jest.fn())
      );
      
      // navigateNext
      act(() => {
        result.current.navigateNext();
      });
      expect(result.current.highlightedIndex).toBe(0);
      
      // navigatePrevious
      act(() => {
        result.current.navigatePrevious();
      });
      expect(result.current.highlightedIndex).toBe(4); // Wraps to last
      
      // navigateFirst
      act(() => {
        result.current.navigateFirst();
      });
      expect(result.current.highlightedIndex).toBe(0);
      
      // navigateLast
      act(() => {
        result.current.navigateLast();
      });
      expect(result.current.highlightedIndex).toBe(4);
      
      // navigateBy
      act(() => {
        result.current.navigateBy(-2);
      });
      expect(result.current.highlightedIndex).toBe(2);
    });
  });

  describe('Home/End Keys', () => {
    it('handles Home and End keys', () => {
      const { result } = renderHook(() => 
        useKeyboardNav(5, { enableHomeEnd: true }, jest.fn())
      );
      
      // Set to middle
      act(() => {
        result.current.setHighlightedIndex(2);
      });
      
      // Home key - go to first
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'Home' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
      
      // End key - go to last
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'End' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(4);
    });
  });

  describe('Vim Navigation', () => {
    it('supports vim-style navigation', () => {
      const { result } = renderHook(() => 
        useKeyboardNav(3, { enableVim: true }, jest.fn())
      );
      
      // Start at first item
      act(() => {
        result.current.setHighlightedIndex(0);
      });
      
      // j - down
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'j' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(1);
      
      // k - up
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'k' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
      
      // g - first
      act(() => {
        result.current.setHighlightedIndex(2);
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'g' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
      
      // G (shift+g) - last
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'g', shiftKey: true }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(2);
    });
  });

  describe('Number Shortcuts', () => {
    it('supports number key shortcuts', () => {
      const onSelect = jest.fn();
      
      const { result } = renderHook(() => 
        useKeyboardNav(9, { enableNumbers: true }, onSelect)
      );
      
      // Press 1 - selects first item (index 0)
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: '1' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
      expect(onSelect).toHaveBeenCalledWith(0);
      
      // Press 5 - selects fifth item (index 4)
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: '5' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(4);
      expect(onSelect).toHaveBeenCalledWith(4);
      
      // Press 9 - selects ninth item (index 8)
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: '9' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(8);
      expect(onSelect).toHaveBeenCalledWith(8);
    });
  });

  describe('Focus Management', () => {
    it('disables navigation when disabled config is used', () => {
      const onSelect = jest.fn();
      
      const { result } = renderHook(() => 
        useKeyboardNav(3, { enableArrows: false }, onSelect)
      );
      
      const initialIndex = result.current.highlightedIndex;
      
      // Arrow keys should not work
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'ArrowDown' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(initialIndex);
    });

    it('resets navigation state', () => {
      const { result } = renderHook(() => 
        useKeyboardNav(3, {}, jest.fn())
      );
      
      // Set some state
      act(() => {
        result.current.setHighlightedIndex(2);
      });
      expect(result.current.isNavigating).toBe(true);
      
      // Reset
      act(() => {
        result.current.resetNavigation();
      });
      expect(result.current.highlightedIndex).toBe(-1);
      expect(result.current.isNavigating).toBe(false);
    });
  });

  describe('Page Navigation', () => {
    it('supports page up/down keys', () => {
      const { result } = renderHook(() => 
        useKeyboardNav(20, { enablePageKeys: true }, jest.fn())
      );
      
      // Start at beginning
      act(() => {
        result.current.setHighlightedIndex(0);
      });
      
      // PageDown - should move by 1/10th of items (2 items)
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'PageDown' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(2);
      
      // PageUp - should move back
      act(() => {
        result.current.handleKeyDown(
          new KeyboardEvent('keydown', { key: 'PageUp' }) as any
        );
      });
      expect(result.current.highlightedIndex).toBe(0);
    });
  });

  describe('Arrow Keys in Radio/Tab Groups', () => {
    it('handles horizontal arrow keys in radio groups', () => {
      const { result } = renderHook(() => 
        useKeyboardNav(3, { enableArrows: true }, jest.fn())
      );
      
      // Create a mock element with role="radiogroup"
      const mockElement = document.createElement('div');
      mockElement.setAttribute('role', 'radiogroup');
      
      // Start at first item
      act(() => {
        result.current.setHighlightedIndex(0);
      });
      
      // ArrowRight in radiogroup
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowRight' }) as any;
        Object.defineProperty(event, 'currentTarget', {
          value: mockElement,
          writable: false
        });
        result.current.handleKeyDown(event);
      });
      expect(result.current.highlightedIndex).toBe(1);
      
      // ArrowLeft in radiogroup
      act(() => {
        const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' }) as any;
        Object.defineProperty(event, 'currentTarget', {
          value: mockElement,
          writable: false
        });
        result.current.handleKeyDown(event);
      });
      expect(result.current.highlightedIndex).toBe(0);
    });
  });
});
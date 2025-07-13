import { useState, useCallback, useEffect, useRef } from 'react';
import { BasePrimitiveProps, BasePrimitiveReturn, ValidationError, Option } from './types';

export interface BaseRankingProps extends BasePrimitiveProps<string[]> {
  /**
   * Available options to rank
   */
  options: Option[];
  
  /**
   * Callback on submit
   */
  onSubmit?: () => void;
  
  /**
   * Enable keyboard navigation
   */
  enableKeyboard?: boolean;
  
  /**
   * Enable touch gestures
   */
  enableTouch?: boolean;
  
  /**
   * Auto-submit on change (default: true for backward compatibility)
   */
  autoSubmitOnChange?: boolean;
  
  /**
   * Custom item renderer
   */
  renderItem?: (item: RankingItem) => React.ReactNode;
}

export interface RankingItem {
  value: string;
  label: string;
  index: number;
  props: React.HTMLAttributes<HTMLElement>;
  isDragging: boolean;
  isDropTarget: boolean;
}

export interface BaseRankingReturn extends BasePrimitiveReturn<string[]> {
  /**
   * Processed items with drag and drop props
   */
  items: RankingItem[];
  
  /**
   * Reorder items by moving from one index to another
   */
  reorder: (fromIndex: number, toIndex: number) => void;
  
  /**
   * Set rank for a specific item (1-based, 0 = unranked)
   */
  setRank: (value: string, rank: number) => void;
  
  /**
   * Get props for a ranking item
   */
  getItemProps: (index: number) => React.HTMLAttributes<HTMLElement>;
  
  /**
   * Currently dragged item value
   */
  draggedItem: string | null;
  
  /**
   * Set dragged item
   */
  setDraggedItem: (value: string | null) => void;
  
  /**
   * Accessibility announcement
   */
  announcement: string;
  
  /**
   * Set accessibility announcement
   */
  setAnnouncement: (message: string) => void;
}

export function BaseRanking(props: BaseRankingProps): BaseRankingReturn {
  const {
    value,
    onChange,
    options,
    disabled = false,
    required = false,
    onValidate,
    onValidationChange,
    autoFocus = false,
    id,
    name,
    ariaLabel,
    ariaDescribedBy,
    onSubmit,
    enableKeyboard = true,
    enableTouch = true,
    autoSubmitOnChange = true,
    renderItem,
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const containerRef = useRef<HTMLElement>(null);
  const touchStartY = useRef<number | null>(null);

  // Get ordered items based on current value
  const getOrderedItems = useCallback(() => {
    if (value.length === 0) {
      return options.map(opt => opt.value);
    }
    return value;
  }, [value, options]);

  // Validate the ranking
  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];

    // Required validation
    if (required && value.length === 0) {
      validationErrors.push({
        type: 'required',
        message: 'Please rank at least one item',
      });
    }

    // Custom validation
    if (onValidate) {
      const customErrors = onValidate(value);
      validationErrors.push(...customErrors);
    }

    setErrors(validationErrors);
    
    // Call onValidationChange if provided
    if (onValidationChange) {
      onValidationChange(validationErrors);
    }
    
    return validationErrors;
  }, [value, required, onValidate, onValidationChange]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && containerRef.current) {
      containerRef.current.focus();
    }
  }, [autoFocus]);

  // Note: Validation is done on-demand via the validate() method
  // to avoid infinite loops with effects

  // Array move utility
  const arrayMove = useCallback((arr: string[], from: number, to: number): string[] => {
    const newArr = [...arr];
    const [removed] = newArr.splice(from, 1);
    newArr.splice(to, 0, removed);
    return newArr;
  }, []);

  // Reorder items
  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    if (disabled) return;
    
    const orderedItems = getOrderedItems();
    if (fromIndex < 0 || fromIndex >= orderedItems.length || 
        toIndex < 0 || toIndex >= orderedItems.length) {
      return;
    }

    const newOrder = arrayMove(orderedItems, fromIndex, toIndex);
    onChange(newOrder);
    setIsTouched(true);
    
    // Announce reorder for screen readers
    const item = options.find(opt => opt.value === orderedItems[fromIndex]);
    if (item) {
      setAnnouncement(`${item.label} moved from position ${fromIndex + 1} to position ${toIndex + 1}`);
    }
    
    // Auto-submit if enabled
    if (autoSubmitOnChange && onSubmit) {
      onSubmit();
    }
  }, [disabled, getOrderedItems, onChange, options, autoSubmitOnChange, onSubmit]);

  // Set rank for an item
  const setRank = useCallback((itemValue: string, rank: number) => {
    if (disabled) return;

    const currentOrder = getOrderedItems();
    const currentIndex = currentOrder.indexOf(itemValue);
    
    if (rank === 0) {
      // Unrank the item (remove from ranking)
      if (currentIndex !== -1) {
        const newOrder = currentOrder.filter(v => v !== itemValue);
        onChange(newOrder);
        setIsTouched(true);
        
        if (autoSubmitOnChange && onSubmit) {
          onSubmit();
        }
      }
      return;
    }

    // Adjust rank to 0-based index
    const targetIndex = rank - 1;
    
    if (currentIndex === -1) {
      // Item not in ranking, add it at the specified position
      const newOrder = [...currentOrder];
      newOrder.splice(targetIndex, 0, itemValue);
      onChange(newOrder);
    } else if (currentIndex !== targetIndex) {
      // Move item to new position
      const newOrder = arrayMove(currentOrder, currentIndex, targetIndex);
      onChange(newOrder);
    }
    
    setIsTouched(true);
    
    if (autoSubmitOnChange && onSubmit) {
      onSubmit();
    }
  }, [disabled, getOrderedItems, onChange, autoSubmitOnChange, onSubmit]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (disabled || !enableKeyboard) return;

    const target = event.target as HTMLElement;
    const indexStr = target.dataset?.index;
    if (!indexStr) return;
    
    const index = parseInt(indexStr);
    const orderedItems = getOrderedItems();

    if (event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      
      if (event.key === 'ArrowUp' && index > 0) {
        reorder(index, index - 1);
      } else if (event.key === 'ArrowDown' && index < orderedItems.length - 1) {
        reorder(index, index + 1);
      }
    }
  }, [disabled, enableKeyboard, getOrderedItems, reorder]);

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, value: string) => {
    if (disabled) return;
    
    setDraggedItem(value);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', value);
  }, [disabled]);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDropTarget(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (disabled || !draggedItem) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [disabled, draggedItem]);

  const handleDrop = useCallback((e: React.DragEvent, targetValue: string) => {
    if (disabled || !draggedItem) return;
    
    e.preventDefault();
    
    const orderedItems = getOrderedItems();
    const fromIndex = orderedItems.indexOf(draggedItem);
    const toIndex = orderedItems.indexOf(targetValue);
    
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      reorder(fromIndex, toIndex);
    }
    
    setDraggedItem(null);
    setDropTarget(null);
  }, [disabled, draggedItem, getOrderedItems, reorder]);

  const handleDragEnter = useCallback((value: string) => {
    if (!disabled && draggedItem && draggedItem !== value) {
      setDropTarget(value);
    }
  }, [disabled, draggedItem]);

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent, value: string) => {
    if (disabled || !enableTouch) return;
    
    touchStartY.current = e.touches[0].clientY;
    setDraggedItem(value);
  }, [disabled, enableTouch]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (disabled || !enableTouch || !draggedItem || touchStartY.current === null) return;
    
    e.preventDefault();
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    
    if (element && element.hasAttribute('data-ranking-item')) {
      const targetValue = element.getAttribute('data-value');
      if (targetValue && targetValue !== draggedItem) {
        setDropTarget(targetValue);
      }
    }
  }, [disabled, enableTouch, draggedItem]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (disabled || !enableTouch || !draggedItem) return;
    
    if (dropTarget) {
      const orderedItems = getOrderedItems();
      const fromIndex = orderedItems.indexOf(draggedItem);
      const toIndex = orderedItems.indexOf(dropTarget);
      
      if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
        reorder(fromIndex, toIndex);
      }
    }
    
    setDraggedItem(null);
    setDropTarget(null);
    touchStartY.current = null;
  }, [disabled, enableTouch, draggedItem, dropTarget, getOrderedItems, reorder]);

  const clear = useCallback(() => {
    onChange([]);
    setErrors([]);
    setIsTouched(false);
    setDraggedItem(null);
    setDropTarget(null);
    setAnnouncement('');
  }, [onChange]);

  const reset = useCallback(() => {
    onChange([]);
    setErrors([]);
    setIsTouched(false);
    setDraggedItem(null);
    setDropTarget(null);
    setAnnouncement('');
  }, [onChange]);

  const getItemProps = useCallback((index: number) => {
    const orderedItems = getOrderedItems();
    const itemValue = orderedItems[index];
    
    const props: React.HTMLAttributes<HTMLElement> = {
      id: id ? `${id}-item-${index}` : undefined,
      role: 'listitem',
      'aria-grabbed': draggedItem === itemValue,
      'data-index': index.toString(),
      'data-value': itemValue,
      'data-ranking-item': 'true',
      tabIndex: disabled ? -1 : 0,
      draggable: !disabled,
      onDragStart: (e) => handleDragStart(e, itemValue),
      onDragEnd: handleDragEnd,
      onDragOver: handleDragOver,
      onDrop: (e) => handleDrop(e, itemValue),
      onDragEnter: () => handleDragEnter(itemValue),
      onDragLeave: handleDragLeave,
    };

    if (enableTouch && !disabled) {
      props.onTouchStart = (e) => handleTouchStart(e, itemValue);
      props.onTouchMove = handleTouchMove;
      props.onTouchEnd = handleTouchEnd;
    }

    return props;
  }, [
    id, 
    disabled, 
    draggedItem, 
    getOrderedItems,
    handleDragStart, 
    handleDragEnd, 
    handleDragOver, 
    handleDrop,
    handleDragEnter,
    handleDragLeave,
    enableTouch,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  ]);

  // Generate items with props
  const items: RankingItem[] = getOrderedItems().map((itemValue, index) => {
    const option = options.find(opt => opt.value === itemValue);
    if (!option) {
      return {
        value: itemValue,
        label: itemValue,
        index,
        props: getItemProps(index),
        isDragging: draggedItem === itemValue,
        isDropTarget: dropTarget === itemValue,
      };
    }
    
    return {
      value: option.value,
      label: option.label,
      index,
      props: getItemProps(index),
      isDragging: draggedItem === itemValue,
      isDropTarget: dropTarget === itemValue,
    };
  });

  const containerProps: React.HTMLAttributes<HTMLElement> = {
    ref: containerRef,
    id: id ? `${id}-container` : undefined,
    tabIndex: disabled ? -1 : 0,
    onKeyDown: enableKeyboard ? handleKeyDown : undefined,
    'aria-label': ariaLabel || 'Ranking list',
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': errors.length > 0,
    'aria-required': required,
    'aria-disabled': disabled,
    role: 'list',
  };

  return {
    value,
    errors,
    containerProps,
    isValid: errors.length === 0,
    isTouched,
    setTouched: setIsTouched,
    validate,
    clear,
    reset,
    items,
    reorder,
    setRank,
    getItemProps,
    draggedItem,
    setDraggedItem,
    announcement,
    setAnnouncement,
  };
}
"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { BaseRanking } from '../../primitives';
import { Option as SelectOption } from '../../primitives/types';
import { cn } from '../../../lib/utils';
import { ChevronDown, GripVertical, ArrowRight } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from '../../../ui/button';

export type FormMode = 'chat' | 'typeform';

export interface UnifiedRankingProps {
  mode: FormMode;
  options: SelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
}

interface SortableItemProps {
  id: string;
  option: SelectOption;
  rank: number;
  index: number;
  disabled?: boolean;
  onRankChange: (value: string, rank: number) => void;
  totalOptions: number;
  mode: FormMode;
}

function SortableItem({ 
  id, 
  option, 
  rank, 
  _index, 
  disabled, 
  onRankChange, 
  totalOptions, 
  mode 
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Mode-specific styling
  const containerClass = mode === 'chat'
    ? cn(
        "flex items-center gap-3 p-4 rounded-lg border-2 border-border/50 bg-card/50 backdrop-blur hover:border-primary/50 transition-all duration-200",
        isDragging && "opacity-50"
      )
    : cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
        "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
        isDragging && "opacity-50",
        disabled && "opacity-50 cursor-not-allowed"
      );

  const handleClass = mode === 'chat'
    ? cn(
        "touch-none p-1 flex-shrink-0",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-grab active:cursor-grabbing hover:bg-accent rounded"
      )
    : cn(
        "touch-none flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent",
        disabled && "opacity-50 cursor-not-allowed"
      );

  return (
    <div ref={setNodeRef} style={style} className={containerClass}>
      {/* Rank Dropdown */}
      <div className="relative flex-shrink-0">
        <select
          value={rank}
          onChange={(e) => onRankChange(option.value, parseInt(e.target.value))}
          disabled={disabled}
          className={cn(
            "appearance-none px-3 py-1 pr-8 rounded border bg-background text-sm transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
            "border-border text-foreground hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          aria-label={`Rank for ${option.label}`}
        >
          <option value={0}>--</option>
          {Array.from({ length: totalOptions }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 pointer-events-none text-muted-foreground" />
      </div>

      {/* Option Label */}
      <span className={cn(
        "flex-1 text-base",
        mode === 'typeform' ? "text-foreground" : ""
      )}>
        {option.label}
      </span>

      {/* Drag Handle */}
      <button
        className={handleClass}
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="Drag to reorder"
        type="button"
      >
        <GripVertical className={cn(
          "text-muted-foreground",
          mode === 'chat' ? "h-5 w-5" : "h-4 w-4"
        )} />
      </button>
    </div>
  );
}

export function UnifiedRanking({
  mode,
  options,
  value = [],
  onChange,
  onSubmit,
  disabled = false,
  required = false,
  showKeyboardHints = true,
}: UnifiedRankingProps) {
  
  // Track if user has made any changes (for chat mode continue button)
  const [hasInteracted, setHasInteracted] = useState(false);
  
  // Track if we've already submitted to prevent double submission (chat mode)
  const hasSubmittedRef = useRef(false);

  // Use BaseRanking for core logic with mode-specific configuration
  const ranking = BaseRanking({
    value,
    onChange,
    options,
    disabled,
    required,
    onSubmit,
    // UNIFIED BEHAVIOR: Neither mode auto-submits, both require manual submission
    autoSubmitOnChange: false,
    enableKeyboard: false, // We handle keyboard through @dnd-kit
    enableTouch: false, // We handle touch through @dnd-kit
  });

  // Helper to get current rankings as a map
  const getRankingsMap = useCallback(() => {
    const map: Record<string, number> = {};
    value.forEach((optionValue, index) => {
      map[optionValue] = index + 1;
    });
    // Add unranked items
    options.forEach(opt => {
      if (!(opt.value in map)) {
        map[opt.value] = 0;
      }
    });
    return map;
  }, [value, options]);

  const handleRankChange = useCallback((optionValue: string, newRank: number) => {
    if (mode === 'chat') {
      setHasInteracted(true);
    }
    
    if (newRank === 0) {
      // Remove from ranking
      const newValue = value.filter(v => v !== optionValue);
      onChange(newValue);
    } else {
      // RESTORED: Auto-fill logic from original ChatRanking for both modes
      // If this is the first ranking action, auto-fill all positions
      if (!value.length) {
        // Create initial ranking with all items
        const allRanked = options.map(opt => opt.value);
        // Move the selected item to the desired position
        const targetIndex = newRank - 1;
        const currentIndex = allRanked.indexOf(optionValue);
        if (currentIndex !== -1 && currentIndex !== targetIndex) {
          const reorderedItems = arrayMove(allRanked, currentIndex, targetIndex);
          onChange(reorderedItems);
        } else {
          onChange(allRanked);
        }
      } else {
        // Use BaseRanking's setRank method logic
        ranking.setRank(optionValue, newRank);
      }
    }
  }, [value, onChange, ranking, options, mode]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSubmit) {
      e.preventDefault();
      if (!required || value.length > 0) {
        if (mode === 'typeform') {
          onSubmit();
        } else if (mode === 'chat' && hasInteracted) {
          handleContinue();
        }
      }
    }
  }, [onSubmit, value, required, mode, hasInteracted]);

  const handleContinue = useCallback(() => {
    if (onSubmit && !hasSubmittedRef.current) {
      hasSubmittedRef.current = true;
      onSubmit();
    }
  }, [onSubmit]);

  // Sort options for display
  const rankingsMap = getRankingsMap();
  const sortedOptions = [...options].sort((a, b) => {
    const rankA = rankingsMap[a.value] || 999;
    const rankB = rankingsMap[b.value] || 999;
    return rankA - rankB;
  });

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id && over) {
      if (mode === 'chat') {
        setHasInteracted(true);
      }
      
      // Get current order based on both ranked and unranked items
      const allItems = [...options].sort((a, b) => {
        const rankA = rankingsMap[a.value] || 999;
        const rankB = rankingsMap[b.value] || 999;
        return rankA - rankB;
      });

      const oldIndex = allItems.findIndex(opt => opt.value === active.id);
      const newIndex = allItems.findIndex(opt => opt.value === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const reorderedItems = arrayMove(allItems, oldIndex, newIndex);
        
        // Auto-fill all items on first drag for both modes (unified behavior)
        if (!value.length || (value.length === 1 && !value.includes(active.id as string))) {
          // Auto-fill all items with their positions
          const allRanked = reorderedItems.map(item => item.value);
          onChange(allRanked);
        } else {
          // Otherwise, just update the moved items
          const newValue = reorderedItems
            .filter(item => value.includes(item.value) || item.value === active.id)
            .map(item => item.value);
          
          onChange(newValue);
        }
      }
    }
  }, [options, value, onChange, rankingsMap, mode]);

  // Reset submission flag when component remounts or options change
  useEffect(() => {
    hasSubmittedRef.current = false;
  }, [options]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3" onKeyDown={handleKeyDown}>
        <SortableContext
          items={sortedOptions.map(opt => opt.value)}
          strategy={verticalListSortingStrategy}
        >
          <div className={mode === 'chat' ? "space-y-2" : "space-y-3"}>
            {sortedOptions.map((option, index) => {
              const currentRank = rankingsMap[option.value] || 0;
              
              return (
                <SortableItem
                  key={option.value}
                  id={option.value}
                  option={option}
                  rank={currentRank}
                  index={index}
                  disabled={disabled}
                  onRankChange={handleRankChange}
                  totalOptions={options.length}
                  mode={mode}
                />
              );
            })}
          </div>
        </SortableContext>
        
        {/* Chat Mode: Show continue button after first interaction */}
        {mode === 'chat' && onSubmit && hasInteracted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="flex items-center mt-4"
          >
            <Button 
              onClick={handleContinue}
              disabled={disabled || (required && value.length === 0)}
              size="lg" 
              className="group"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </motion.div>
        )}
        
        {/* Keyboard hints */}
        {showKeyboardHints && !disabled && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-2"
          >
            Drag to reorder or use dropdowns to adjust ranking
            {mode === 'chat' && hasInteracted && " • Press Enter to continue"}
          </motion.div>
        )}
      </div>
    </DndContext>
  );
}
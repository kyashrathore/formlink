"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
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
import { GripVertical, ChevronDown } from "lucide-react";
import { cn } from "@formlink/ui/lib/utils";

interface RankingOption {
  value: string;
  label: string;
}

interface RankingInputProps {
  options: RankingOption[];
  value: string[];
  onChange: (value: string[]) => void;
  maxSelections?: number;
  disabled?: boolean;
}

// Component for sortable items
function SortableItem({
  id,
  option,
  rank,
  disabled,
  onRankChange,
  totalOptions,
  isMobile,
}: {
  id: string;
  option: RankingOption;
  rank: number;
  disabled?: boolean;
  onRankChange: (value: string, rank: number) => void;
  totalOptions: number;
  isMobile: boolean;
}) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center rounded-lg transition-all duration-200",
        isMobile ? "gap-2 px-3 py-2" : "gap-3 px-4 py-3",
        "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
        isDragging && "opacity-50",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      {/* Rank Dropdown - matching unified pattern */}
      <div className="relative flex-shrink-0">
        <select
          value={rank}
          onChange={(e) => onRankChange(option.value, parseInt(e.target.value))}
          disabled={disabled}
          className={cn(
            "appearance-none rounded border bg-background transition-all duration-200",
            isMobile ? "px-2 py-0.5 pr-6 text-xs" : "px-3 py-1 pr-8 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary",
            "border-border text-foreground hover:border-primary/50",
            disabled && "opacity-50 cursor-not-allowed",
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
      <span
        className={cn(
          "flex-1 text-foreground",
          isMobile ? "text-sm" : "text-base",
        )}
      >
        {option.label}
      </span>

      {/* Drag Handle */}
      <button
        className={cn(
          "touch-none flex-shrink-0 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-accent",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label="Drag to reorder"
        type="button"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}

export default function RankingInput({
  options,
  value,
  onChange,
  disabled = false,
}: RankingInputProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  // Helper to get current rankings as a map
  const getRankingsMap = useCallback(() => {
    const map: Record<string, number> = {};
    value.forEach((optionValue, index) => {
      map[optionValue] = index + 1;
    });
    // Add unranked items
    options.forEach((opt) => {
      if (!(opt.value in map)) {
        map[opt.value] = 0;
      }
    });
    return map;
  }, [value, options]);

  const handleRankChange = useCallback(
    (optionValue: string, newRank: number) => {
      if (newRank === 0) {
        // Remove from ranking
        const newValue = value.filter((v) => v !== optionValue);
        onChange(newValue);
      } else {
        // Auto-fill logic matching unified pattern
        if (!value.length) {
          // Create initial ranking with all items
          const allRanked = options.map((opt) => opt.value);
          // Move the selected item to the desired position
          const targetIndex = newRank - 1;
          const currentIndex = allRanked.indexOf(optionValue);
          if (currentIndex !== -1 && currentIndex !== targetIndex) {
            const reorderedItems = arrayMove(
              allRanked,
              currentIndex,
              targetIndex,
            );
            onChange(reorderedItems);
          } else {
            onChange(allRanked);
          }
        } else {
          // Reorder existing rankings
          const currentRankings = [...value];
          const currentIndex = currentRankings.indexOf(optionValue);

          if (currentIndex === -1) {
            // Item not yet ranked, insert at position
            currentRankings.splice(newRank - 1, 0, optionValue);
          } else {
            // Move to new position
            currentRankings.splice(currentIndex, 1);
            currentRankings.splice(newRank - 1, 0, optionValue);
          }
          onChange(currentRankings);
        }
      }
    },
    [value, onChange, options],
  );

  // Sort options for display
  const rankingsMap = getRankingsMap();
  const sortedOptions = useMemo(() => {
    return [...options].sort((a, b) => {
      const rankA = rankingsMap[a.value] || 999;
      const rankB = rankingsMap[b.value] || 999;
      return rankA - rankB;
    });
  }, [options, rankingsMap]);

  // Drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Handle drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (active.id !== over?.id && over) {
        // Get current order based on both ranked and unranked items
        const allItems = [...options].sort((a, b) => {
          const rankA = rankingsMap[a.value] || 999;
          const rankB = rankingsMap[b.value] || 999;
          return rankA - rankB;
        });

        const oldIndex = allItems.findIndex(
          (opt: RankingOption) => opt.value === active.id,
        );
        const newIndex = allItems.findIndex(
          (opt: RankingOption) => opt.value === over.id,
        );

        if (oldIndex !== -1 && newIndex !== -1) {
          const reorderedItems = arrayMove(allItems, oldIndex, newIndex);

          // Auto-fill all items on first drag
          if (
            !value.length ||
            (value.length === 1 && !value.includes(active.id as string))
          ) {
            // Auto-fill all items with their positions
            const allRanked = reorderedItems.map(
              (item: RankingOption) => item.value,
            );
            onChange(allRanked);
          } else {
            // Otherwise, just update the moved items
            const newValue = reorderedItems
              .filter(
                (item: RankingOption) =>
                  value.includes(item.value) || item.value === active.id,
              )
              .map((item: RankingOption) => item.value);

            onChange(newValue);
          }
        }
      }
    },
    [options, value, onChange, rankingsMap],
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-3">
        <SortableContext
          items={sortedOptions.map((opt) => opt.value)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {sortedOptions.map((option) => {
              const currentRank = rankingsMap[option.value] || 0;

              return (
                <SortableItem
                  key={option.value}
                  id={option.value}
                  option={option}
                  rank={currentRank}
                  disabled={disabled}
                  onRankChange={handleRankChange}
                  totalOptions={options.length}
                  isMobile={isMobile}
                />
              );
            })}
          </div>
        </SortableContext>

        {/* Helper text */}
        <div
          className={cn(
            "flex items-center justify-center gap-2 text-muted-foreground pt-2",
            isMobile ? "text-xs" : "text-sm",
          )}
        >
          {isMobile
            ? "Tap dropdowns to rank"
            : "Drag to reorder or use dropdowns to set ranking"}
        </div>
      </div>
    </DndContext>
  );
}

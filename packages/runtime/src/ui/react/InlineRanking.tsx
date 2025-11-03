"use client";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as React from "react";
import { useIsMobile } from "./hooks/use-mobile";
import { useRanking } from "@/headless/react/hooks/useRanking";

export type InlineOption<T = string> = { value: T; label: string };

export interface InlineRankingProps<T = string> {
  options: InlineOption<T>[];
  value: T[]; // ordered ranking; empty or subset allowed
  onChange: (next: T[]) => void;
  onSubmit?: () => void;
  showKeyboardHints?: boolean;
  autoFocus?: boolean;
  className?: string;
}

function SortableRow<T = string>({
  id,
  option,
  rank,
  total,
  onRankChange,
  onRowKeyDown,
  bindSelectRef,
}: {
  id: T;
  option: InlineOption<T>;
  rank: number;
  total: number;
  onRankChange: (val: T, rank: number) => void;
  onRowKeyDown: (e: React.KeyboardEvent) => void;
  bindSelectRef: (id: T, el: HTMLSelectElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: id as unknown as string });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || "transform 180ms ease",
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-lg transition-all duration-200 min-h-[56px] px-5 py-4 bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border outline-none focus:outline-none"
      tabIndex={-1}
      onKeyDown={onRowKeyDown}
      aria-label={`Ranking row for ${option.label}`}
    >
      {/* Rank selector (left) */}
      <div className="relative flex-shrink-0">
        <select
          ref={(el) => bindSelectRef(id, el)}
          value={rank}
          onChange={(e) => onRankChange(id, parseInt(e.target.value))}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              // Coerce native select to open on Enter by simulating Space
              try {
                const ev = new KeyboardEvent("keydown", {
                  key: " ",
                  bubbles: true,
                });
                e.currentTarget.dispatchEvent(ev);
                e.preventDefault();
              } catch {}
            }
          }}
          className="appearance-none px-3 py-1 pr-8 rounded border bg-background text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary border-border text-foreground hover:border-primary/50"
          aria-label={`Rank for ${option.label}`}
        >
          <option value={0}>--</option>
          {Array.from({ length: total }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}
            </option>
          ))}
        </select>
        <svg
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 011.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* Label */}
      <span className="flex-1 text-base">{option.label}</span>

      {/* Drag handle on right */}
      <button
        type="button"
        className="touch-none flex-shrink-0 p-1 rounded hover:bg-accent text-muted-foreground cursor-grab active:cursor-grabbing hover:cursor-pointer select-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 4h2v2H7V4zm4 0h2v2h-2V4zM7 9h2v2H7V9zm4 0h2v2h-2V9zM7 14h2v2H7v-2zm4 0h2v2h-2v-2z" />
        </svg>
      </button>
    </div>
  );
}

export function InlineRanking<T = string>({
  options,
  value,
  onChange,
  onSubmit,
  showKeyboardHints = true,
  autoFocus = false,
  className,
}: InlineRankingProps<T>) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const isMobile = useIsMobile();
  React.useEffect(() => {
    if (autoFocus) {
      try {
        containerRef.current?.focus();
      } catch {}
    }
  }, [autoFocus]);

  const total = options.length;
  const optionMap = React.useMemo(
    () => new Map<T, InlineOption<T>>(options.map((o) => [o.value, o])),
    [options],
  );
  const rk = useRanking<T>({ options, value, onChange });

  // Map of value -> select ref
  const selectRefMap = React.useRef(new Map<T, HTMLSelectElement | null>());
  const bindSelectRef = (id: T, el: HTMLSelectElement | null) => {
    selectRefMap.current.set(id, el);
  };

  const setRank = (optVal: T, rank: number) => rk.setRank(optVal, rank);

  const handleRowKeyDown = (id: T) => (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      const sel = selectRefMap.current.get(id) || null;
      if (sel) {
        e.preventDefault();
        sel.focus();
        try {
          const ev = new KeyboardEvent("keydown", { key: " ", bubbles: true });
          sel.dispatchEvent(ev);
        } catch {}
      }
    }
  };

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    rk.onDragEnd(active.id as unknown as T, over.id as unknown as T);
  };

  return (
    <div
      ref={containerRef}
      tabIndex={autoFocus ? 0 : -1}
      className={["w-full max-w-2xl space-y-3", className]
        .filter(Boolean)
        .join(" ")}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={rk.orderedValues.map((v) => String(v))}
          strategy={verticalListSortingStrategy}
        >
          {rk.orderedValues.map((val) => {
            const opt = optionMap.get(val)!;
            const rank = rk.ranksMap.get(val) ?? 0;
            return (
              <SortableRow
                key={String(val)}
                id={val}
                option={opt}
                rank={rank}
                total={total}
                onRankChange={setRank}
                onRowKeyDown={handleRowKeyDown(val)}
                bindSelectRef={bindSelectRef}
              />
            );
          })}
        </SortableContext>
      </DndContext>
      {showKeyboardHints && !isMobile && (
        <div className="text-sm text-muted-foreground">
          Tab to a row, press Enter to open its rank selector. Drag the handle
          on the right to reorder. 1 is highest.
        </div>
      )}
      {/* Use page-level footer for continue in typeform flows */}
    </div>
  );
}

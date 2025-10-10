"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import React from "react";
import { useIsMobile } from "../../../hooks/ui/use-mobile";
import { cn } from "../../../lib/utils";
import { Button } from "../../../ui/button";
import { filterMultiSelectContainerProps } from "../../primitives/patches/accessibility-fixes";
import {
  useBaseMultiSelect,
  type BaseMultiSelectProps,
} from "../../primitives/useBaseMultiSelect";
import { getChatAnimations, getTypeFormAnimations } from "../shared/animations";

export type FormMode = "chat" | "typeform";

export interface UnifiedMultiSelectProps extends BaseMultiSelectProps {
  mode: FormMode;
  onSubmit?: () => void;
  showSelectionCount?: boolean;
  showKeyboardHints?: boolean;
  className?: string;
  density?: "compact" | "comfy" | "spacious";
  enableSearch?: boolean;
  searchableThreshold?: number; // enable search when options >= threshold
  searchPlaceholder?: string;
  listMaxHeightClass?: string; // e.g., "max-h-80"
}

export function UnifiedMultiSelect(props: UnifiedMultiSelectProps) {
  const {
    mode,
    onSubmit,
    showSelectionCount = true,
    className,
    density,
    enableSearch,
    searchableThreshold = 6,
    searchPlaceholder = "Search...",
    listMaxHeightClass = "max-h-80",
    ...baseProps
  } = props;

  // ALL HOOKS MUST BE CALLED UNCONDITIONALLY AT THE TOP
  const isMobile = useIsMobile();

  const base = useBaseMultiSelect<string>({
    enableShortcuts: true,
    enableArrowNavigation: true,
    ...baseProps,
    value: baseProps.value || [],
  });

  // Search filtering for large lists (primarily Typeform mode)
  const [query, setQuery] = React.useState("");

  // Safe access with fallbacks
  const options = base.options || [];
  const selectedValues = base.value || [];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    // Let base handle navigation, only handle Enter for submission
    base.getContainerProps().onKeyDown?.(e);

    if (
      e.key === "Enter" &&
      !e.defaultPrevented &&
      onSubmit &&
      selectedValues.length > 0
    ) {
      e.preventDefault();
      onSubmit();
    }
  };

  const handleSubmit = () => {
    if (onSubmit && selectedValues.length > 0) {
      onSubmit();
    }
  };

  // Search filtering for large lists (primarily Typeform mode)
  const isSearchActive =
    (enableSearch ?? options.length >= searchableThreshold) &&
    mode === "typeform";
  const filteredOptions = React.useMemo(() => {
    if (!isSearchActive) return options;
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => String(opt.label).toLowerCase().includes(q));
  }, [options, isSearchActive, query]);

  // no local hidden state; parent controls visibility

  if (mode === "typeform") {
    // TypeForm layout and behavior
    const containerProps = base.getContainerProps();
    const {
      "aria-required": ariaRequired,
      "aria-invalid": ariaInvalid,
      "aria-disabled": ariaDisabled,
      "aria-describedby": ariaDescribedBy,
      onKeyDown: _baseKeyDown,
      tabIndex,
      id,
      ..._restContainerProps
    } = containerProps;

    const resolvedDensity = density ?? "spacious";
    const densityClasses =
      resolvedDensity === "compact"
        ? "px-3 py-2"
        : resolvedDensity === "comfy"
          ? "px-4 py-3"
          : "px-5 py-4";

    return (
      <div
        id={id}
        tabIndex={tabIndex}
        role="group"
        aria-label={baseProps.ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={cn("space-y-3", className)}
        onKeyDown={handleKeyDown}
      >
        <div className={cn(isSearchActive ? "flex flex-col h-80" : undefined)}>
          {isSearchActive && (
            <div className="mb-3 h-10">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full h-10 rounded-md border px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                aria-label="Search options"
              />
            </div>
          )}
          <div
            role="listbox"
            aria-multiselectable="true"
            aria-label={baseProps.ariaLabel}
            aria-required={ariaRequired}
            aria-invalid={ariaInvalid}
            aria-disabled={ariaDisabled}
            className={cn(
              "space-y-3 w-full overflow-x-hidden p-1",
              isSearchActive && `${listMaxHeightClass} flex-1 overflow-y-auto`,
            )}
            data-allow-scroll
          >
            {filteredOptions.map((option, index) => {
              const shortcutKey = String.fromCharCode(65 + index); // A, B, C, etc.

              return (
                <motion.div
                  key={option.value}
                  role={option.props.role}
                  aria-selected={option.props["aria-selected"]}
                  aria-disabled={option.props["aria-disabled"]}
                  tabIndex={option.props.tabIndex}
                  {...getTypeFormAnimations(index, true)}
                  className={cn(
                    `flex items-center ${!isMobile && mode === "typeform" ? "gap-3" : "gap-0"} w-full rounded-lg cursor-pointer transition-all duration-200 min-h-[60px] box-border`,
                    densityClasses,
                    // Fixed border width prevents left-edge bleed/shift on hover/selected
                    option.isSelected
                      ? "bg-primary/10 border-2 border-primary"
                      : "bg-muted/30 border-2 border-border/50 hover:bg-muted/60 hover:border-border",
                    option.disabled && "opacity-50 cursor-not-allowed",
                  )}
                  onClick={() =>
                    !option.disabled && base.toggleOption(option.value)
                  }
                >
                  {/* Letter indicator - hidden on mobile and chat mode */}
                  {!isMobile && mode === "typeform" && (
                    <div
                      className={cn(
                        "flex items-center justify-center w-8 h-8 rounded text-sm font-semibold",
                        option.isSelected
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-primary border border-primary",
                      )}
                    >
                      {shortcutKey}
                    </div>
                  )}

                  {/* Option label */}
                  <span
                    className={cn(
                      "flex-1 text-base",
                      option.isSelected
                        ? "text-foreground font-medium"
                        : "text-foreground",
                    )}
                  >
                    {option.label}
                  </span>

                  {/* Check icon for selected */}
                  {option.isSelected && (
                    <svg
                      className="w-5 h-5 text-primary"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Reserve space for selection count to avoid layout jump */}
        {showSelectionCount && (
          <div
            className="mt-2 h-5 text-muted-foreground text-sm"
            aria-live="polite"
          >
            {selectedValues.length > 0
              ? `${selectedValues.length} selected`
              : "\u00A0"}
          </div>
        )}

        {/* TypeForm mode: No manual submit button - auto-submits immediately via autoSubmitOnChange */}
      </div>
    );
  }

  return (
    <div
      {...filterMultiSelectContainerProps(base.getContainerProps())}
      className={cn("space-y-3 focus:outline-none", className)}
      onKeyDown={handleKeyDown}
    >
      {/* Optional keyboard hints */}
      {props.showKeyboardHints && (
        <div className="text-sm text-muted-foreground">
          Use A, B, C… or click to select. Press Enter to continue.
        </div>
      )}
      {/* Options list */}
      <div className="space-y-3">
        {filteredOptions.map((option, index) => {
          const shortcutKey = String.fromCharCode(65 + index); // A, B, C, …
          return (
            <motion.button
              key={option.value}
              type="button"
              role="button"
              aria-pressed={option.isSelected}
              aria-disabled={option.disabled}
              disabled={option.disabled}
              onClick={() =>
                !option.disabled && base.toggleOption(option.value)
              }
              {...getChatAnimations(index)}
              className={cn(
                "group flex items-center gap-3 rounded-lg border-2 cursor-pointer transition-all duration-200 w-full text-left px-4 py-3",
                option.isSelected
                  ? "bg-primary/10 border-primary"
                  : "border-border/50 bg-card hover:border-primary/50 hover:bg-muted/50",
                option.isHighlighted && !option.isSelected && "border-primary",
                option.disabled &&
                  "opacity-50 cursor-not-allowed hover:bg-card hover:border-border/50",
              )}
            >
              {/* Letter indicator pill (Typeform-like) */}
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded text-sm font-semibold",
                  option.isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-primary border border-primary",
                )}
                aria-hidden="true"
              >
                {shortcutKey}
              </div>

              <span
                className={cn(
                  "flex-1 text-base",
                  option.disabled && "text-muted-foreground",
                )}
              >
                {option.label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Selection count */}
      {showSelectionCount && (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
          <span>
            {selectedValues.length} selected
            {props.maxSelections && ` of ${props.maxSelections}`}
          </span>
        </div>
      )}

      {/* Submit button for chat mode */}
      {onSubmit && selectedValues.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center mt-4"
        >
          <Button onClick={handleSubmit} size="lg" className="group">
            Continue
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      )}
    </div>
  );
}

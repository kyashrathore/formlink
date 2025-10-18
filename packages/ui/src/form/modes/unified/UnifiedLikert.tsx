"use client";

import React from "react";
import { useBaseSelect } from "../../primitives/useBaseSelect";
import { cn } from "../../../lib/utils";
import { motion } from "motion/react";
import { getChatAnimations, getTypeFormAnimations } from "../shared/animations";

export type FormMode = "chat" | "typeform";

export interface UnifiedLikertProps {
  mode: FormMode;
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
  className?: string;
  density?: "compact" | "comfy" | "spacious";
  debug?: boolean;
}

export function UnifiedLikert({
  mode,
  options,
  value,
  onChange,
  onSubmit,
  disabled = false,
  required = false,
  showKeyboardHints = mode === "typeform",
  className,
  density,
  debug = false,
}: UnifiedLikertProps) {
  const select = useBaseSelect<string>({
    options: options.map((o) => ({ value: o, label: o })),
    value: value,
    onChange,
    disabled,
    required,
    onSubmit,
    // Prevent double-submit in chat; allow auto-advance in Typeform only
    autoSubmitOnChange: mode === "typeform",
    autoFocus: mode === "typeform",
    a11yContainerRole: "group",
    a11yHasPopup: false,
    a11yIncludeExpanded: false,
  });

  const showError = select.isTouched && select.errors.length > 0;
  const resolvedDensity = density ?? (mode === "chat" ? "compact" : "spacious");

  const containerProps = select.getContainerProps();

  if (mode === "typeform") {
    const dbg = debug;
    if (dbg) {
      try {
        // One-time render log
        console.debug("[UnifiedLikert][typeform] render", {
          value,
          optionsCount: options?.length ?? 0,
        });
      } catch {
        // Debug logging failed, ignore
      }
    }
    const padding =
      resolvedDensity === "compact"
        ? "py-2 px-3"
        : resolvedDensity === "comfy"
          ? "py-3 px-4"
          : "py-4 px-5";
    return (
      <div
        className={cn("w-full max-w-2xl space-y-3", className)}
        data-ul-mode="typeform"
      >
        <div
          {...containerProps}
          className="space-y-3"
          onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
            containerProps.onMouseDown?.(e);
            if (dbg) {
              try {
                console.debug(
                  "[UnifiedLikert][typeform] mousedown target:",
                  (e.target as HTMLElement)?.tagName,
                );
              } catch {
                // Debug logging failed, ignore
              }
            }
          }}
        >
          {select.options.map((opt, index) => {
            const p = (opt.props ||
              {}) as React.ButtonHTMLAttributes<HTMLButtonElement>;
            const safeProps = {
              id: p.id,
              role: p.role,
              "aria-selected": p["aria-selected"],
              "aria-disabled": p["aria-disabled"],
              tabIndex: p.tabIndex,
              onMouseEnter: p.onMouseEnter,
            } as const;
            return (
              <motion.button
                key={opt.value}
                type="button"
                {...safeProps}
                {...getTypeFormAnimations(index)}
                className={cn(
                  "w-full text-left rounded-lg border transition-all duration-200 min-h-[52px] flex items-center",
                  padding,
                  opt.isSelected
                    ? "bg-primary/10 border-2 border-primary"
                    : "bg-muted/30 border border-border/50 hover:bg-muted/60 hover:border-border",
                  disabled && "opacity-50 cursor-not-allowed",
                )}
                onClick={(_e) => {
                  if (disabled) return;
                  try {
                    if (dbg) {
                      console.debug("[UnifiedLikert][typeform] click option", {
                        index,
                        value: opt.value,
                        before: select.value,
                      });
                    }
                    select.selectByIndex(index);
                    if (dbg) {
                      setTimeout(() => {
                        try {
                          console.debug(
                            "[UnifiedLikert][typeform] after select",
                            {
                              value: select.value,
                            },
                          );
                        } catch {
                          // Debug logging failed, ignore
                        }
                      }, 0);
                    }
                  } catch {
                    // Debug logging failed, ignore
                  }
                }}
              >
                <span
                  className={cn(
                    "block",
                    opt.isSelected ? "font-medium" : undefined,
                  )}
                >
                  {opt.label}
                </span>
              </motion.button>
            );
          })}
        </div>
        {showKeyboardHints && !disabled && (
          <div className="text-sm text-muted-foreground">
            Use number keys or ↑↓ to select
          </div>
        )}
        {showError && (
          <p className="text-sm text-destructive">
            {select.errors[0]?.message}
          </p>
        )}
      </div>
    );
  }

  // Chat mode
  const padding =
    resolvedDensity === "compact"
      ? "py-2 px-3"
      : resolvedDensity === "comfy"
        ? "py-3 px-4"
        : "py-4 px-5";
  return (
    <div
      {...containerProps}
      className={cn("space-y-2", className)}
      data-ul-mode="chat"
    >
      {select.options.map((opt, index) => {
        const p = (opt.props ||
          {}) as React.ButtonHTMLAttributes<HTMLButtonElement>;
        const safeProps = {
          id: p.id,
          role: p.role,
          "aria-selected": p["aria-selected"],
          "aria-disabled": p["aria-disabled"],
          tabIndex: p.tabIndex,
          onMouseEnter: p.onMouseEnter,
        } as const;
        return (
          <motion.button
            key={opt.value}
            type="button"
            {...safeProps}
            {...getChatAnimations(index)}
            className={cn(
              "w-full text-left rounded-lg border-2 transition-all duration-200",
              padding,
              opt.isSelected
                ? "bg-primary/10 border-primary"
                : "border-border/50 bg-card hover:border-primary/50 hover:bg-muted/50",
              opt.isHighlighted && !opt.isSelected && "border-primary",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            onClick={(_e) => {
              if (disabled) return;
              try {
                select.selectByIndex(index);
              } catch {
                // Debug logging failed, ignore
              }
            }}
          >
            <span
              className={cn(
                "block text-sm",
                opt.isSelected ? "font-medium" : undefined,
              )}
            >
              {opt.label}
            </span>
          </motion.button>
        );
      })}
      {showError && (
        <p className="text-sm text-destructive">{select.errors[0]?.message}</p>
      )}
    </div>
  );
}

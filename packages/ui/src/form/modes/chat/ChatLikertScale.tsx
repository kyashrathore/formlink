"use client";

import React from "react";
import { BaseSelect } from "../../primitives/BaseSelect";
import { Button } from "../../../ui/button";
import { cn } from "../../../lib/utils";
import { Option } from "../../primitives/types";

export interface ChatLikertScaleProps {
  options: string[];
  value: string | null;
  onChange: (value: string | null) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  showKeyboardHints?: boolean;
}

export function ChatLikertScale({
  options,
  value,
  onChange,
  onSubmit,
  disabled = false,
  required = false,
  showKeyboardHints = false,
}: ChatLikertScaleProps) {
  // Convert string options to SelectOption format
  const selectOptions: Option[] = options.map((option) => ({
    value: option,
    label: option,
  }));

  const base = BaseSelect({
    options: selectOptions,
    value,
    onChange,
    disabled,
    required,
    onSubmit,
  });

  const showError = base.isTouched && base.errors.length > 0;

  return (
    <div className="space-y-3">
      <div {...base.containerProps} className="space-y-2">
        {selectOptions.map((option, index) => {
          const isSelected = value === option.value;
          const isHighlighted = base.highlightedIndex === index;
          const shortcutKey = index < 5 ? (index + 1).toString() : null;

          return (
            <Button
              key={option.value}
              {...base.getOptionProps(index)}
              variant={isSelected ? "default" : "outline"}
              className={cn(
                "w-full justify-start h-auto py-3 px-4 text-left",
                isHighlighted && !isSelected && "ring-2 ring-ring",
                disabled && "opacity-50 cursor-not-allowed",
              )}
            >
              {shortcutKey && (
                <span className="mr-3 text-xs bg-muted px-1.5 py-0.5 rounded">
                  {shortcutKey}
                </span>
              )}
              <span className="flex-1">{option.label}</span>
            </Button>
          );
        })}
      </div>

      {showError && (
        <p className="text-sm text-destructive text-center">
          {base.errors[0]?.message}
        </p>
      )}

      {showKeyboardHints && !disabled && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          Use number keys or{" "}
          <kbd className="px-1.5 py-0.5 text-xs bg-muted text-muted-foreground rounded">
            ↑↓
          </kbd>{" "}
          to select
        </div>
      )}
    </div>
  );
}

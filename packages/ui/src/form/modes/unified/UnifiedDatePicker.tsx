"use client";

import React from "react";
import { motion } from "motion/react";
import { BaseDatePicker } from "../../primitives/BaseDatePicker";
import { cn } from "../../../lib/utils";
import { Button } from "../../../ui/button";
import { ArrowRight, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover";

export type FormMode = "chat" | "typeform";

export interface UnifiedDatePickerProps {
  mode: FormMode;
  value: Date | null;
  onChange: (value: Date | null) => void;
  onSubmit?: () => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
}

export function UnifiedDatePicker({
  mode,
  value,
  onChange,
  onSubmit,
  disabled = false,
  required = false,
  placeholder = "Select date",
  autoFocus = false,
  className,
  minDate,
  maxDate,
  disabledDates = [],
}: UnifiedDatePickerProps) {
  const datePicker = BaseDatePicker({
    value,
    onChange,
    disabled,
    required,
    placeholder,
    autoFocus: mode === "typeform" ? autoFocus : false,
    minDate,
    maxDate,
    disabledDates,
    onSubmit,
    // Neither mode auto-submits on date change
    autoSubmitOnChange: false,
  });

  const {
    formattedValue,
    isCalendarOpen,
    openCalendar,
    closeCalendar,
    triggerProps,
    calendar,
    errors,
  } = datePicker;

  const hasError = errors.length > 0;

  // Handle manual continue (chat mode only)
  const handleContinue = () => {
    if (onSubmit && value) {
      onSubmit();
    }
  };

  // Unified styling for both modes
  const triggerClass = cn(
    "w-full flex items-center justify-between px-3 py-2 border rounded-lg transition-all duration-200",
    "text-base bg-background hover:bg-accent/50",
    "focus:outline-none focus:border-primary focus:ring-0",
    hasError
      ? "border-red-500"
      : value
        ? "border-green-500"
        : "border-border hover:border-border-hover",
    disabled && "opacity-50 cursor-not-allowed",
  );

  const containerClass = mode === "chat" ? "space-y-6" : "space-y-4";

  return (
    <div className={cn(containerClass, className)}>
      <Popover
        open={isCalendarOpen}
        onOpenChange={(open) => (open ? openCalendar() : closeCalendar())}
      >
        <PopoverTrigger asChild>
          <button {...triggerProps} className={triggerClass} type="button">
            <span
              className={value ? "text-foreground" : "text-muted-foreground"}
            >
              {value ? formattedValue : placeholder}
            </span>
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-3">
            {/* Calendar Header */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={calendar.previousMonth}
                className="p-1 hover:bg-accent rounded"
                type="button"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <h4 className="font-semibold text-sm">
                {calendar.currentMonth.toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </h4>

              <button
                onClick={calendar.nextMonth}
                className="p-1 hover:bg-accent rounded"
                type="button"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div
                  key={day}
                  className="h-8 w-8 flex items-center justify-center text-xs font-medium text-muted-foreground"
                >
                  {day}
                </div>
              ))}

              {/* Calendar days */}
              {calendar.getDaysInMonth().map((day, index) => (
                <button
                  key={index}
                  type="button"
                  className={cn(
                    "h-8 w-8 text-sm rounded transition-colors",
                    "hover:bg-accent focus:outline-none focus:bg-accent",
                    day.isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50",
                    day.isSelected &&
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                    day.isToday && !day.isSelected && "bg-accent font-semibold",
                    day.isDisabled &&
                      "opacity-50 cursor-not-allowed hover:bg-transparent",
                  )}
                  {...day.props}
                  disabled={day.isDisabled}
                >
                  {day.date.getDate()}
                </button>
              ))}
            </div>

            {/* Today button */}
            <div className="flex justify-center mt-3 pt-3 border-t">
              <button
                onClick={calendar.goToToday}
                className="text-sm text-primary hover:underline"
                type="button"
              >
                Today
              </button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Error Messages */}
      {hasError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-sm text-red-500 text-center"
        >
          {errors[0]?.message}
        </motion.div>
      )}

      {/* Continue Button - ONLY for Chat Mode */}
      {mode === "chat" && onSubmit && value && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center mt-4"
        >
          <Button
            onClick={handleContinue}
            disabled={disabled || hasError}
            size="lg"
            className="group"
          >
            Continue
            <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </motion.div>
      )}

      {/* TypeForm Mode: No continue button - let parent handle navigation */}
    </div>
  );
}

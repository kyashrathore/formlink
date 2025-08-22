"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@formlink/ui/lib/utils";
import {
  Button,
  Calendar,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@formlink/ui";

interface DatePickerWrapperProps {
  value: string;
  onChange: (value: string) => void;
  dateFormat?: "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";
  disabled?: boolean;
}

export default function DatePickerWrapper({
  value,
  onChange,
  dateFormat = "MM/DD/YYYY",
  disabled = false,
}: DatePickerWrapperProps) {
  const [open, setOpen] = useState(false);

  // Convert string to Date object
  const dateValue = value ? new Date(value) : undefined;

  // Format date for display
  const getDisplayFormat = (format: string) => {
    switch (format) {
      case "MM/DD/YYYY":
        return "MM/dd/yyyy";
      case "DD/MM/YYYY":
        return "dd/MM/yyyy";
      case "YYYY-MM-DD":
        return "yyyy-MM-dd";
      default:
        return "MM/dd/yyyy";
    }
  };

  const displayFormat = getDisplayFormat(dateFormat);

  // Handle date selection
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      // Convert to ISO string for consistent storage
      const isoString = date.toISOString().split("T")[0] || "";
      onChange(isoString);
    } else {
      onChange("");
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !dateValue && "text-muted-foreground",
          )}
          disabled={disabled}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {dateValue ? (
            format(dateValue, displayFormat)
          ) : (
            <span>Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleDateSelect}
          disabled={disabled}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

"use client";

import { Button } from "../ui/button";
import { ScrollArea, ScrollBar } from "../ui/scroll-area";
import { cn } from "../lib/utils";

export function Suggestions({
  children,
  className,
  ...props
}: React.ComponentProps<typeof ScrollArea>) {
  return (
    <ScrollArea
      className={cn("w-full whitespace-nowrap", className)}
      {...props}
    >
      <div className="flex gap-2 p-1">{children}</div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}

export function Suggestion({
  suggestion,
  onClick,
  className,
  ...props
}: {
  suggestion: string;
  onClick?: (s: string) => void;
} & Omit<React.ComponentProps<typeof Button>, "onClick">) {
  return (
    <Button
      size="sm"
      variant="outline"
      className={cn("rounded-full", className)}
      onClick={() => onClick?.(suggestion)}
      {...props}
    >
      {suggestion}
    </Button>
  );
}

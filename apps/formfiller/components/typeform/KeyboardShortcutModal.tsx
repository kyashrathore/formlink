"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@formlink/ui";
import { cn } from "@/lib/utils";

interface KeyboardShortcutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { key: "Enter ↵", description: "Submit answer / Continue to next" },
  { key: "↑ ↓", description: "Navigate between questions" },
  { key: "0-9", description: "Quick select for rating/scale questions" },
  { key: "A-Z", description: "Quick select for choice questions" },
  { key: "Tab", description: "Move focus forward" },
  { key: "Shift + Tab", description: "Move focus backward" },
  { key: "Mouse Scroll", description: "Navigate questions (Desktop)" },
  { key: "Swipe Up/Down", description: "Navigate questions (Mobile)" },
  { key: "?", description: "Show this help" },
];

export default function KeyboardShortcutModal({
  open,
  onOpenChange,
}: KeyboardShortcutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate and answer questions quickly using your keyboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-4">
          {shortcuts.map((shortcut) => (
            <div
              key={shortcut.key}
              className="flex items-center justify-between py-2"
            >
              <kbd
                className={cn(
                  "px-2 py-1 text-xs font-semibold",
                  "bg-muted text-muted-foreground",
                  "border rounded-md",
                  "min-w-[80px] text-center",
                )}
              >
                {shortcut.key}
              </kbd>
              <span className="text-sm text-muted-foreground ml-4">
                {shortcut.description}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 text-xs text-muted-foreground text-center">
          Press <kbd className="px-1 py-0.5 text-xs border rounded">Esc</kbd> to
          close
        </div>
      </DialogContent>
    </Dialog>
  );
}

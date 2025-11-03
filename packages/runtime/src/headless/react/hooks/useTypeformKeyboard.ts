"use client";
import * as React from "react";
import type { RuntimeApi, RuntimeValidationResult } from "../../../types";

export type TypeformKeyboardFeatures = {
  enterToContinue?: boolean;
  lettersForChoices?: boolean;
  numbersForScale?: boolean;
  helpShortcut?: boolean;
};

export type UseTypeformKeyboardOptions = {
  scopeRef?: React.RefObject<HTMLElement | null>;
  enabled?: boolean;
  features?: TypeformKeyboardFeatures;
  runtime: RuntimeApi;
  onNext?: () => void | Promise<void>;
  onHelp?: () => void;
  isOverlayOpen?: boolean;
  bailSelectors?: string[];
  isMobile?: boolean;
};

function isEditableTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName?.toLowerCase();
  if (node.isContentEditable) return true;
  if (!tag) return false;
  return tag === "input" || tag === "textarea" || tag === "select";
}

function withinScope(
  scope: HTMLElement | null | undefined,
  target: EventTarget | null,
): boolean {
  if (!scope) return true;
  const node = target as Node | null;
  if (!node) return false;
  return scope.contains(node);
}

export function useTypeformKeyboard(options: UseTypeformKeyboardOptions): void {
  const {
    scopeRef,
    enabled = true,
    features,
    runtime,
    onNext,
    onHelp,
    isOverlayOpen = false,
    bailSelectors = ["[data-fl-keyscope-stop]"],
    isMobile = false,
  } = options;

  const onNextRef = React.useRef(onNext);
  onNextRef.current = onNext;
  const advanceTimerRef = React.useRef<number | null>(null);

  const handleKeyDown = React.useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || isMobile) return;
      if (isOverlayOpen) return;
      if (e.defaultPrevented) return;
      if ((e as any).isComposing) return;
      const scopeEl = scopeRef?.current ?? null;
      // Editable targets normally bail to avoid double-submission.
      // Exception: allow Enter on input[type="date"] so optional date can advance.
      if (isEditableTarget(e.target)) {
        const node = e.target as
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | null;
        const tag = (node?.tagName || "").toLowerCase();
        const type =
          node && (node as HTMLInputElement).type
            ? (node as HTMLInputElement).type.toLowerCase()
            : "";
        const allowEnterHere = tag === "input" && type === "date";
        if (!allowEnterHere) return;
      }
      for (const sel of bailSelectors) {
        try {
          const node = e.target as HTMLElement | null;
          if (node && node.closest && node.closest(sel)) return;
        } catch {}
      }

      const f = features ?? {
        enterToContinue: true,
        lettersForChoices: true,
        numbersForScale: true,
      };

      // Handle global choice shortcuts (letters A–Z, digits 1–9) for single/multi/likert
      {
        const hasMod = e.shiftKey || e.metaKey || e.ctrlKey || e.altKey;
        const key = e.key;
        const isLetter = /^[a-zA-Z]$/.test(key);
        const isDigit = /^[1-9]$/.test(key);
        if ((f.lettersForChoices ?? true) && !hasMod && (isLetter || isDigit)) {
          try {
            const currentId =
              runtime.context.currentId ??
              runtime.context.firstUnansweredId ??
              null;
            if (currentId) {
              const q: any = runtime.context.get.q(currentId);
              const name: string | undefined = q?.type?.name;
              if (
                name === "singleChoice" ||
                name === "multipleChoice" ||
                name === "likertScale"
              ) {
                const rawOptions: any[] = Array.isArray(q?.type?.options)
                  ? q.type.options
                  : [];
                let idx = -1;
                if (isLetter) idx = key.toUpperCase().charCodeAt(0) - 65;
                else if (isDigit) idx = parseInt(key, 10) - 1;
                if (idx >= 0 && idx < rawOptions.length) {
                  e.preventDefault();
                  const opt = rawOptions[idx];
                  const choice =
                    name === "likertScale"
                      ? (opt as string)
                      : (opt?.value as any);
                  if (choice != null) {
                    if (name === "singleChoice" || name === "likertScale") {
                      runtime.actions.set(currentId, choice);
                      if (onNextRef.current) {
                        if (advanceTimerRef.current != null)
                          window.clearTimeout(advanceTimerRef.current);
                        advanceTimerRef.current = window.setTimeout(() => {
                          onNextRef.current?.();
                        }, 150);
                      }
                    } else {
                      const raw: any = runtime.context.get.value(currentId);
                      let arr: string[] = [];
                      if (Array.isArray(raw)) arr = raw as string[];
                      else if (typeof raw === "string" && raw.length)
                        arr = raw
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean);
                      const set = new Set(arr.map(String));
                      const sv = String(choice);
                      if (set.has(sv)) set.delete(sv);
                      else set.add(sv);
                      const next = rawOptions
                        .filter((o: any) => set.has(String(o.value)))
                        .map((o: any) => o.value);
                      runtime.actions.set(currentId, next);
                    }
                    return; // handled
                  }
                }
              }
            }
          } catch {}
        }
      }

      // Global numeric shortcuts for linear scale and rating
      if ((f.numbersForScale ?? true) && /^[1-9]$/.test(e.key)) {
        try {
          const currentId =
            runtime.context.currentId ??
            runtime.context.firstUnansweredId ??
            null;
          if (currentId) {
            const q: any = runtime.context.get.q(currentId);
            const name: string | undefined = q?.type?.name;
            const num = parseInt(e.key, 10);
            if (name === "linearScale") {
              const cfg = q?.type?.config ?? {};
              const start = Number(cfg.start ?? 1);
              const end = Number(cfg.end ?? 1);
              const step = Number(cfg.step ?? 1);
              const inRange =
                start <= end
                  ? num >= start && num <= end
                  : num <= start && num >= end;
              const aligns = (num - start) % step === 0;
              if (inRange && aligns) {
                e.preventDefault();
                runtime.actions.set(currentId, num);
                if (onNextRef.current) {
                  if (advanceTimerRef.current != null)
                    window.clearTimeout(advanceTimerRef.current);
                  advanceTimerRef.current = window.setTimeout(() => {
                    onNextRef.current?.();
                  }, 150);
                }
                return;
              }
            } else if (name === "rating") {
              const cfg = q?.type?.config ?? {};
              const min = Number(cfg.min ?? 1);
              const max = Number(cfg.max ?? 5);
              if (num >= min && num <= max) {
                e.preventDefault();
                runtime.actions.set(currentId, num);
                if (onNextRef.current) {
                  if (advanceTimerRef.current != null)
                    window.clearTimeout(advanceTimerRef.current);
                  advanceTimerRef.current = window.setTimeout(() => {
                    onNextRef.current?.();
                  }, 150);
                }
                return;
              }
            }
          }
        } catch {}
      }

      const isInsideScope = withinScope(scopeEl, e.target);
      if (
        f.enterToContinue &&
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        // If the event originated on an option element, never trigger global continue.
        // This prevents advancing while toggling items in multi-select.
        try {
          const targetEl = e.target as HTMLElement | null;
          if (
            targetEl &&
            targetEl.closest &&
            targetEl.closest('[role="option"]')
          ) {
            return;
          }
        } catch {}
        // Skip global Enter for multi-select; let the control own Enter to avoid double handling.
        if (isInsideScope) {
          try {
            const currentId =
              runtime.context.currentId ??
              runtime.context.firstUnansweredId ??
              null;
            if (currentId) {
              const q: any = runtime.context.get.q(currentId);
              const name: string | undefined = q?.type?.name;
              if (name === "multipleChoice") return; // let control handle when inside scope
            }
          } catch {}
        }
        e.preventDefault();
        const fn = onNextRef.current;
        if (fn) void fn();
        else {
          try {
            const currentId =
              runtime.context.currentId ??
              runtime.context.firstUnansweredId ??
              null;
            if (!currentId) return;
            void runtime.actions
              .validate(currentId)
              .then((res: RuntimeValidationResult) => {
                if (res.isValid) return runtime.actions.next();
                return;
              });
          } catch {}
        }
        return;
      }

      // Help shortcut only when inside scope to avoid global conflicts
      if (isInsideScope && f.helpShortcut && e.key === "?") {
        e.preventDefault();
        onHelp?.();
        return;
      }
    },
    [
      enabled,
      isMobile,
      isOverlayOpen,
      scopeRef,
      bailSelectors,
      features,
      runtime,
      onHelp,
    ],
  );

  React.useEffect(() => {
    // Capture phase to see the event before UI libraries call preventDefault
    // (e.g., PopoverTrigger on Enter). We gate behavior strictly, so this is safe.
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, {
        capture: true,
      } as any);
  }, [handleKeyDown]);
}

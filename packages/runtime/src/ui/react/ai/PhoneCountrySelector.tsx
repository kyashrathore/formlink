"use client";
import * as React from "react";
import { buildCountryOptions, iso2ToFlag } from "../country-utils";
import { useUiComponents } from "../primitives/context";
import { detectInputIntent, extractDialCode } from "@/headless/ai/input-intent";

export type PhoneCountrySelectorProps = {
  value: string;
  onValueChange: (next: string) => void;
  countries?: Array<{
    code: string;
    name: string;
    flag: string;
    dialCode: string;
  }>;
  getControlElement?: () => HTMLTextAreaElement | HTMLInputElement | null;
  className?: string;
  triggerLabel?: string;
};

export function PhoneCountrySelector({
  value,
  onValueChange,
  countries: countriesProp,
  getControlElement,
  className,
  triggerLabel = "Change",
}: PhoneCountrySelectorProps) {
  const ui = useUiComponents();
  const countries = React.useMemo(
    () => countriesProp ?? buildCountryOptions(),
    [countriesProp],
  );
  const [open, setOpen] = React.useState(false);
  const contentRef = React.useRef<HTMLDivElement | null>(null);

  const intent = React.useMemo(() => detectInputIntent(value), [value]);
  const selected = React.useMemo(() => {
    const dial = intent.dialCode || extractDialCode(value);
    if (!dial) return null;
    return countries.find((c) => c.dialCode === dial) ?? null;
  }, [countries, intent.dialCode, value]);

  // We rely on cmdk's internal filtering via CommandInput and CommandItem value

  const getControl = React.useCallback(() => {
    if (getControlElement) return getControlElement();
    // Fallback: traverse to nearest input-group (works with @formlink/ui PromptInput)
    try {
      const root = contentRef.current?.parentElement?.closest(
        '[data-slot="input-group"]',
      ) as HTMLElement | null;
      if (!root) return null;
      const ta = root.querySelector(
        'textarea[data-slot="input-group-control"]',
      ) as HTMLTextAreaElement | null;
      const inp = root.querySelector(
        'input[data-slot="input-group-control"]',
      ) as HTMLInputElement | null;
      return (ta as any) || (inp as any) || null;
    } catch {
      return null;
    }
  }, [getControlElement]);

  const handleSelect = (iso2: string, dialCode: string) => {
    // Capture caret before change
    const el = getControl();
    const start = (el as any)?.selectionStart ?? null;
    const end = (el as any)?.selectionEnd ?? null;

    const current = value || "";
    const oldLeadMatch = current.match(/^(?:\+|00)?\d{1,4}\s?/);
    const oldLeadLen = oldLeadMatch ? oldLeadMatch[0].length : 0;
    const rest = current.slice(oldLeadLen);
    const next = `${dialCode}${rest ? " " + rest : ""}`;
    const newLeadLen = dialCode.length + (rest ? 1 : 0);

    onValueChange(next);
    setOpen(false);

    if (start !== null && end !== null) {
      const delta = newLeadLen - oldLeadLen;
      let ns = start;
      let ne = end;
      const withinOldLead = (pos: number) => pos <= oldLeadLen;
      if (withinOldLead(end)) {
        ns = ne = newLeadLen;
      } else if (withinOldLead(start) && !withinOldLead(end)) {
        ns = ne = newLeadLen;
      } else {
        ns = Math.max(0, start + delta);
        ne = Math.max(0, end + delta);
      }
      requestAnimationFrame(() => {
        const ctrl = getControl();
        if (!ctrl) return;
        try {
          (ctrl as any).focus();
          (ctrl as any).setSelectionRange(ns, ne);
        } catch {}
      });
    }
  };

  const PopoverRoot = ui.PopoverRoot as any;
  const PopoverTrigger = ui.PopoverTrigger as any;
  const PopoverContent = ui.PopoverContent as any;
  const CommandRoot = ui.CommandRoot as any;
  const CommandInput = ui.CommandInput as any;
  const CommandList = ui.CommandList as any;
  const CommandGroup = ui.CommandGroup as any;
  const CommandEmpty = ui.CommandEmpty as any;
  const CommandItem = ui.CommandItem as any;

  // If host supplies PromptInputHoverCard primitives via context, use them; else fall back to Popover
  const HC: any = (ui as any).PromptInputHoverCard;
  const HCT: any = (ui as any).PromptInputHoverCardTrigger;
  const HCC: any = (ui as any).PromptInputHoverCardContent;
  const Button: any = (ui as any).PromptInputButton;
  if (HC && HCT && HCC) {
    return (
      <div className={className}>
        <HC
          open={open}
          onOpenChange={(next: boolean) => {
            if (next) return setOpen(true);
            const ae = (typeof document !== "undefined" &&
              document.activeElement) as Element | null;
            if (contentRef.current && ae && contentRef.current.contains(ae)) {
              setOpen(true);
            } else {
              setOpen(false);
            }
          }}
          openDelay={0}
          closeDelay={200}
        >
          <HCT>
            {Button ? (
              <Button
                size="sm"
                variant="outline"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setOpen((v: boolean) => !v);
                }}
              >
                <span className="mr-1">
                  {iso2ToFlag(selected?.code || "")} {selected?.dialCode || "+"}
                </span>
                <span className="text-muted-foreground">{triggerLabel}</span>
              </Button>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs"
                onClick={(e: React.MouseEvent) => {
                  e.preventDefault();
                  setOpen((v: boolean) => !v);
                }}
              >
                <span className="mr-1">
                  {iso2ToFlag(selected?.code || "")} {selected?.dialCode || "+"}
                </span>
                <span className="text-muted-foreground">{triggerLabel}</span>
              </button>
            )}
          </HCT>
          <HCC ref={contentRef as any} className="w-72 p-0">
            <CommandRoot>
              <CommandInput placeholder="Search country or code" />
              <CommandList>
                <CommandEmpty>No results</CommandEmpty>
                <CommandGroup className="max-h-64 overflow-auto">
                  {countries.map((c) => (
                    <CommandItem
                      key={c.code}
                      value={`${c.name} ${c.dialCode}`}
                      onSelect={() => handleSelect(c.code, c.dialCode)}
                    >
                      <span className="mr-2">{c.flag}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="rounded bg-muted px-1 py-0.5 text-[10px]">
                        {c.dialCode}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </CommandRoot>
          </HCC>
        </HC>
      </div>
    );
  }

  return (
    <div className={className}>
      <PopoverRoot open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded border px-2 py-1 text-xs"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              setOpen((v: boolean) => !v);
            }}
          >
            <span className="mr-1">
              {iso2ToFlag(selected?.code || "")} {selected?.dialCode || "+"}
            </span>
            <span className="text-muted-foreground">{triggerLabel}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent ref={contentRef} className="w-72 p-0">
          <CommandRoot>
            <CommandInput placeholder="Search country or code" />
            <CommandList>
              <CommandEmpty>No results</CommandEmpty>
              <CommandGroup className="max-h-64 overflow-auto">
                {countries.map((c) => (
                  <CommandItem
                    key={c.code}
                    value={`${c.name} ${c.dialCode}`}
                    onSelect={() => handleSelect(c.code, c.dialCode)}
                  >
                    <span className="mr-2">{c.flag}</span>
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="rounded bg-muted px-1 py-0.5 text-[10px]">
                      {c.dialCode}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </CommandRoot>
        </PopoverContent>
      </PopoverRoot>
    </div>
  );
}

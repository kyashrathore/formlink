"use client";

import { cn } from "@/lib/utils";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import React from "react";
// Simplified: rely on Radix Portal + absolute positioning; remove rAF/observers and debug logs

type ScopedDrawerContextValue = {
  containerEl: HTMLElement | null;
  scoped: boolean;
  open: boolean;
  setOpen?: (next: boolean) => void;
};

const ScopedDrawerContext = React.createContext<ScopedDrawerContextValue>({
  containerEl: null,
  scoped: false,
  open: false,
});

// SSR guard helper
const isClient = () => typeof window !== "undefined";

const resolveDefaultContainer = (): HTMLElement | null => {
  if (typeof window === "undefined") return null;
  return document.getElementById("right-panel-root");
};

function ScopedDrawer({
  modal = false,
  open: openProp,
  defaultOpen,
  onOpenChange,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root> & {
  modal?: boolean;
}) {
  const isControlled = openProp !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(
    defaultOpen ?? false,
  );
  const open = isControlled ? Boolean(openProp) : uncontrolledOpen;

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  return (
    <ScopedDrawerContext.Provider
      value={{ containerEl: null, scoped: false, open, setOpen }}
    >
      <DialogPrimitive.Root
        modal={modal}
        open={openProp}
        defaultOpen={defaultOpen}
        onOpenChange={setOpen}
        {...props}
      />
    </ScopedDrawerContext.Provider>
  );
}

const ScopedDrawerTrigger = DialogPrimitive.Trigger;
const ScopedDrawerClose = DialogPrimitive.Close;

function ScopedDrawerPortal({
  container,
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  container?: HTMLElement | null;
}) {
  const [resolved, setResolved] = React.useState<HTMLElement | null>(null);
  const parent = React.useContext(ScopedDrawerContext);

  // Resolve the portal container on mount/prop change. Keep it simple.
  React.useEffect(() => {
    if (!isClient()) return;
    const next = (container as HTMLElement | null) || resolveDefaultContainer();
    setResolved(next ?? null);
  }, [container]);

  const ctx = React.useMemo(
    () => ({
      ...parent,
      containerEl: resolved,
      scoped: Boolean(resolved),
    }),
    [parent, resolved],
  );

  return (
    <ScopedDrawerContext.Provider value={ctx}>
      {!resolved ? null : (
        <DialogPrimitive.Portal container={resolved}>
          <div
            data-slot="scoped-drawer-portal"
            data-resolved-id={resolved?.id || ""}
            data-scoped={String(Boolean(resolved))}
            className={cn("z-[60] absolute inset-0", className)}
            {...props}
          >
            {children}
          </div>
        </DialogPrimitive.Portal>
      )}
    </ScopedDrawerContext.Provider>
  );
}

const ScopedDrawerOverlay = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> & { clipToLeft?: boolean }
>(function ScopedDrawerOverlay(
  { className, clipToLeft = true, style, ...props },
  ref,
) {
  const { scoped, open, setOpen } = React.useContext(ScopedDrawerContext);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="presentation"
      aria-hidden
      data-slot="scoped-drawer-overlay"
      data-scoped={String(scoped)}
      data-open={String(open)}
      className={cn(
        "bg-background/50 backdrop-blur-sm",
        scoped ? "absolute inset-0 z-50" : "fixed inset-0 z-50",
        className,
      )}
      style={style}
      onClick={() => setOpen?.(false)}
      {...props}
    />
  );
});

const slideBySide: Record<"top" | "bottom" | "left" | "right", string> = {
  top: "data-[state=open]:slide-in-from-top data-[state=closed]:slide-out-to-top",
  bottom:
    "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  left: "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  right:
    "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
};

const ScopedDrawerContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentProps<typeof DialogPrimitive.Content> & {
    side?: "top" | "bottom" | "left" | "right";
  }
>(function ScopedDrawerContent(
  { className, children, side = "right", onInteractOutside, ...props },
  ref,
) {
  const { scoped, containerEl } = React.useContext(ScopedDrawerContext);

  type InteractOutsideEvent = Parameters<
    NonNullable<
      React.ComponentProps<typeof DialogPrimitive.Content>["onInteractOutside"]
    >
  >[0];

  const handleInteractOutside: React.ComponentProps<
    typeof DialogPrimitive.Content
  >["onInteractOutside"] = (e) => {
    // Allow consumer to handle first.
    onInteractOutside?.(e);
    if (e.defaultPrevented) return;

    // If the pointer interaction started outside the scoped container
    // (e.g., the left panel), prevent closing but do not block the event.
    const target = (e as InteractOutsideEvent)?.detail?.originalEvent
      ?.target as Node | null;
    if (containerEl && target && !containerEl.contains(target)) {
      e.preventDefault();
    }
  };

  return (
    <DialogPrimitive.Content
      ref={ref}
      data-slot="scoped-drawer-content"
      data-scoped={String(scoped)}
      className={cn(
        "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        slideBySide[side],
        // Ensure content sits above overlay regardless of DOM order.
        scoped
          ? "absolute inset-y-0 right-0 z-[62] flex h-full w-3/4 flex-col sm:max-w-sm"
          : "fixed inset-y-0 right-0 z-[62] flex h-full w-3/4 flex-col sm:max-w-sm",
        "border-l shadow-2xl",
        className,
      )}
      onInteractOutside={handleInteractOutside}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  );
});

function ScopedDrawerHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scoped-drawer-header"
      className={cn("flex flex-col gap-1.5 border-b px-4 py-3", className)}
      {...props}
    />
  );
}

function ScopedDrawerFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="scoped-drawer-footer"
      className={cn("border-t px-4 py-3", className)}
      {...props}
    />
  );
}

const ScopedDrawerTitle = DialogPrimitive.Title;
const ScopedDrawerDescription = DialogPrimitive.Description;

export {
  ScopedDrawer,
  ScopedDrawerClose,
  ScopedDrawerContent,
  ScopedDrawerDescription,
  ScopedDrawerFooter,
  ScopedDrawerHeader,
  ScopedDrawerOverlay,
  ScopedDrawerPortal,
  ScopedDrawerTitle,
  ScopedDrawerTrigger,
};

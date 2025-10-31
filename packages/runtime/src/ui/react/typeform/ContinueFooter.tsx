"use client";
import * as React from "react";
import type { ComponentPropsWithRef } from "react";
import { usePrimitives } from "../primitives/context";

export function TypeFormContinueFooter({
  onClick,
  isLoadingNext,
  continueLabel = "Continue",
}: {
  onClick: () => void;
  isLoadingNext?: boolean;
  errorMessage?: string | null;
  continueLabel?: string;
}) {
  const primitives = usePrimitives();
  const ButtonPrimitive = primitives.Button;
  const Button: React.FC<ComponentPropsWithRef<"button">> =
    React.useMemo(() => {
      if (ButtonPrimitive) {
        const Element = ButtonPrimitive as React.ElementType;
        const Component: React.FC<ComponentPropsWithRef<"button">> = (props) =>
          React.createElement(Element, { type: "button", ...props });
        Component.displayName = "TypeFormContinueFooterButtonPrimitive";
        return Component;
      }
      const Fallback: React.FC<ComponentPropsWithRef<"button">> = (props) => (
        <button type="button" {...props} />
      );
      Fallback.displayName = "TypeFormContinueFooterButtonFallback";
      return Fallback;
    }, [ButtonPrimitive]);
  // Hide on mobile to match original behavior
  const [isMobile, setIsMobile] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (isMobile) return null;
  return (
    <div className="flex items-center mt-4 gap-2">
      <Button
        onClick={onClick}
        disabled={Boolean(isLoadingNext)}
        className="group mr-4 h-10 px-4 rounded-md bg-primary text-primary-foreground hover:opacity-90"
      >
        <span>{continueLabel}</span>
        {!isLoadingNext && (
          <svg
            className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10.293 3.293a1 1 0 011.414 0l5 5a1 1 0 010 1.414l-5 5a1 1 0 11-1.414-1.414L13.586 11H4a1 1 0 110-2h9.586l-3.293-3.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        )}
        {isLoadingNext && (
          <span className="ml-2 h-4 w-4 inline-block animate-spin border-b-2 border-primary-foreground rounded-full" />
        )}
      </Button>
      <div className="text-sm text-muted-foreground">
        press <kbd className="px-2 py-1 text-xs border rounded">Enter ↵</kbd>
      </div>
    </div>
  );
}

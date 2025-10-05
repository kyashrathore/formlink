"use client";

import { cn } from "@formlink/ui/lib/utils";
import { Badge } from "../ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
// Remove ToolUIPart import as it may not be exported in this version
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  Loader2,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { CodeBlock } from "../ui/code-block";

export type ToolProps = ComponentProps<typeof Collapsible> & {
  state?:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
};

export const Tool = ({ className, state, ...props }: ToolProps) => {
  // Default to open when tool is running
  const shouldDefaultOpen =
    state === "input-streaming" || state === "input-available";

  return (
    <Collapsible
      className={cn("not-prose mb-4 w-full rounded-md border", className)}
      defaultOpen={shouldDefaultOpen}
      {...props}
    />
  );
};

export type ToolHeaderProps = {
  type: string;
  state:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error";
  className?: string;
};

const getStatusBadge = (
  status:
    | "input-streaming"
    | "input-available"
    | "output-available"
    | "output-error",
) => {
  const labels = {
    "input-streaming": "Pending",
    "input-available": "running",
    "output-available": "Completed",
    "output-error": "Error",
  } as const;

  const icons = {
    "input-streaming": <CircleIcon className="size-3" />,
    "input-available": (
      <Loader2 className="size-3 animate-spin translate-y-[6px]" />
    ),
    "output-available": <CheckCircleIcon className="size-3 text-green-600" />,
    "output-error": <XCircleIcon className="size-3 text-red-600" />,
  } as const;

  return (
    <Badge asChild className="rounded-full" variant="secondary">
      <div className="inline-flex items-center gap-1 leading-none">
        {icons[status]}
        {labels[status]}
      </div>
    </Badge>
  );
};

export const ToolHeader = ({
  className,
  type,
  state,
  ...props
}: ToolHeaderProps) => (
  <CollapsibleTrigger
    className={cn(
      "flex w-full items-center justify-between gap-4 p-3",
      className,
    )}
    {...props}
  >
    <div className="flex items-center gap-2 text-left">
      <span className="font-medium text-sm">{type}</span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in",
      className,
    )}
    {...props}
  />
);

export type ToolInputProps = ComponentProps<"div"> & {
  input: unknown;
};

export const ToolInput = ({ className, input, ...props }: ToolInputProps) => (
  <div className={cn("space-y-2 overflow-hidden p-4", className)} {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = ComponentProps<"div"> & {
  output: ReactNode;
  errorText?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export const ToolOutput = ({
  className,
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  return (
    <div className={cn("space-y-2 p-4", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "text-muted-foreground bg-muted/50 rounded px-2 py-1 font-mono text-xs",
          errorText && "bg-destructive/10 text-destructive",
        )}
      >
        {errorText && errorText}
        {output &&
          (typeof output === "string"
            ? output
            : isRecord(output)
              ? // Try to extract a readable message from common response formats
                typeof output.message === "string"
                ? output.message
                : typeof output.summary === "string"
                  ? output.summary
                  : JSON.stringify(output, null, 2)
              : String(output))}
      </div>
    </div>
  );
};

export type ToolLogsProps = ComponentProps<"div"> & {
  logs: string;
};

export const ToolLogs = ({ className, logs, ...props }: ToolLogsProps) => {
  if (!logs) {
    return null;
  }

  return (
    <div className={cn("space-y-2 p-4", className)} {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        Logs
      </h4>
      <div
        className="text-muted-foreground bg-muted/50 rounded px-3 py-2 font-mono text-sm max-h-40 overflow-y-auto whitespace-pre-wrap"
        style={{
          scrollBehavior: "smooth",
        }}
        ref={(div) => {
          // Auto-scroll to bottom when logs update
          if (div) {
            div.scrollTop = div.scrollHeight;
          }
        }}
      >
        {logs}
      </div>
    </div>
  );
};

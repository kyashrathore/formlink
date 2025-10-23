"use client";

import * as React from "react";
import { cn } from "../lib/utils";

export type FieldProps = React.HTMLAttributes<HTMLDivElement>;

function Field({ className, ...props }: FieldProps) {
  return <div className={cn("grid gap-2", className)} {...props} />;
}

export type FieldControlProps = React.HTMLAttributes<HTMLDivElement>;

function FieldControl({ className, ...props }: FieldControlProps) {
  return <div className={cn(className)} {...props} />;
}

export type FieldDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>;

function FieldDescription({ className, ...props }: FieldDescriptionProps) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export type FieldMessageProps = React.HTMLAttributes<HTMLParagraphElement>;

function FieldMessage({ className, children, ...props }: FieldMessageProps) {
  if (!children) return null;
  return (
    <p className={cn("text-sm text-destructive", className)} {...props}>
      {children}
    </p>
  );
}

export { Field, FieldControl, FieldDescription, FieldMessage };

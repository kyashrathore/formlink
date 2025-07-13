"use client";

import React from "react";
import { cn } from "../../lib/utils";
import { AlertCircle, RefreshCcw, Home, WifiOff, FileX } from "lucide-react";
import { Button } from "../button";
import { motion } from "motion/react";

export interface FormErrorStateProps {
  error: "not-found" | "network" | "server" | "unknown";
  message?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  className?: string;
}

const errorConfigs = {
  "not-found": {
    icon: FileX,
    title: "Form not found",
    defaultMessage: "The form you're looking for doesn't exist or has been removed.",
    showRetry: false,
    showHome: true,
  },
  "network": {
    icon: WifiOff,
    title: "Connection issue",
    defaultMessage: "Please check your internet connection and try again.",
    showRetry: true,
    showHome: false,
  },
  "server": {
    icon: AlertCircle,
    title: "Something went wrong",
    defaultMessage: "We're having trouble loading the form. Please try again.",
    showRetry: true,
    showHome: false,
  },
  "unknown": {
    icon: AlertCircle,
    title: "Unexpected error",
    defaultMessage: "An unexpected error occurred. Please try again.",
    showRetry: true,
    showHome: true,
  },
};

export function FormErrorState({
  error,
  message,
  onRetry,
  onGoHome,
  className,
}: FormErrorStateProps) {
  const config = errorConfigs[error];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] p-8 text-center",
        className
      )}
    >
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <Icon className="h-12 w-12 text-destructive" />
      </div>
      
      <h2 className="text-2xl font-semibold mb-2">{config.title}</h2>
      <p className="text-muted-foreground max-w-md mb-6">
        {message || config.defaultMessage}
      </p>
      
      <div className="flex gap-3">
        {config.showRetry && onRetry && (
          <Button onClick={onRetry} variant="default">
            <RefreshCcw className="mr-2 h-4 w-4" />
            Try again
          </Button>
        )}
        {config.showHome && onGoHome && (
          <Button onClick={onGoHome} variant={config.showRetry ? "outline" : "default"}>
            <Home className="mr-2 h-4 w-4" />
            Go home
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export interface SubmissionErrorProps {
  message?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function SubmissionError({
  message = "Failed to save your answer. Please try again.",
  onRetry,
  onDismiss,
  className,
}: SubmissionErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={cn(
        "flex items-center justify-between gap-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0" />
        <p className="text-sm">{message}</p>
      </div>
      
      <div className="flex items-center gap-2">
        {onRetry && (
          <Button size="sm" variant="ghost" onClick={onRetry}>
            Retry
          </Button>
        )}
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export interface ValidationErrorProps {
  message: string;
  className?: string;
}

export function ValidationError({ message, className }: ValidationErrorProps) {
  return (
    <motion.p
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        "text-sm text-destructive mt-1 flex items-center gap-1",
        className
      )}
    >
      <AlertCircle className="h-3 w-3" />
      {message}
    </motion.p>
  );
}

export interface FileUploadErrorProps {
  fileName: string;
  error: "size" | "type" | "network" | "unknown";
  onRetry?: () => void;
  onRemove?: () => void;
  className?: string;
}

const fileErrorMessages = {
  size: "File is too large. Maximum size is 10MB.",
  type: "File type not supported. Please upload a valid file.",
  network: "Upload failed. Please check your connection.",
  unknown: "Upload failed. Please try again.",
};

export function FileUploadError({
  fileName,
  error,
  onRetry,
  onRemove,
  className,
}: FileUploadErrorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={cn(
        "p-3 bg-destructive/10 border border-destructive/20 rounded-lg",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{fileName}</p>
          <p className="text-xs text-destructive mt-1">
            {fileErrorMessages[error]}
          </p>
        </div>
        
        <div className="flex items-center gap-1">
          {onRetry && (
            <Button size="sm" variant="ghost" onClick={onRetry}>
              <RefreshCcw className="h-3 w-3" />
            </Button>
          )}
          {onRemove && (
            <Button size="sm" variant="ghost" onClick={onRemove}>
              ×
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
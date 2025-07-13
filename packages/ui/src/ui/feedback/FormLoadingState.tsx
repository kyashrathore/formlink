"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { motion } from "motion/react";

export interface FormLoadingStateProps {
  message?: string;
  className?: string;
  showProgress?: boolean;
  progress?: number;
}

export function FormLoadingState({
  message = "Loading form...",
  className,
  showProgress = false,
  progress = 0,
}: FormLoadingStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex flex-col items-center justify-center min-h-[400px] p-8",
        className
      )}
    >
      <div className="relative">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        {showProgress && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium">{Math.round(progress)}%</span>
          </div>
        )}
      </div>
      
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      
      {showProgress && (
        <div className="mt-4 w-full max-w-xs">
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
        </div>
      )}
    </motion.div>
  );
}

export interface QuestionLoadingStateProps {
  className?: string;
}

export function QuestionLoadingState({ className }: QuestionLoadingStateProps) {
  return (
    <div className={cn("animate-pulse space-y-4", className)}>
      <div className="h-8 bg-muted rounded-md w-3/4" />
      <div className="h-4 bg-muted rounded-md w-1/2" />
      <div className="space-y-2 mt-6">
        <div className="h-12 bg-muted rounded-md" />
        <div className="h-12 bg-muted rounded-md" />
        <div className="h-12 bg-muted rounded-md" />
      </div>
    </div>
  );
}

export interface SubmissionLoadingStateProps {
  message?: string;
  className?: string;
}

export function SubmissionLoadingState({
  message = "Saving your answer...",
  className,
}: SubmissionLoadingStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={cn(
        "flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-md",
        className
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span className="text-sm font-medium">{message}</span>
    </motion.div>
  );
}

export interface FileUploadLoadingStateProps {
  fileName: string;
  progress: number;
  className?: string;
}

export function FileUploadLoadingState({
  fileName,
  progress,
  className,
}: FileUploadLoadingStateProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground truncate max-w-[200px]">
          {fileName}
        </span>
        <span className="text-primary font-medium">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
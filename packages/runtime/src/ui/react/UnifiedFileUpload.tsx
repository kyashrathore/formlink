"use client";
import * as React from "react";
import { useFileUpload } from "@/headless/react/hooks/useFileUpload";

export type FormMode = "chat" | "typeform";

export interface UnifiedFileUploadProps {
  mode: FormMode;
  questionId?: string;
  value?: File | null;
  onChange?: (file: File | File[] | null) => void;
  onFileUpload?:
    | ((files: File[]) => Promise<void>)
    | ((questionId: string, file: File) => Promise<void>);
  onSubmit?: () => void;
  allowedFileTypes?: string[];
  maxFiles?: number;
  maxSize?: number; // bytes
  className?: string;
}

type FileUploadHandler =
  | ((files: File[]) => Promise<void>)
  | ((questionId: string, file: File) => Promise<void>);

function isQuestionScopedUploadHandler(
  handler: FileUploadHandler,
): handler is (questionId: string, file: File) => Promise<void> {
  return handler.length > 1;
}

export function UnifiedFileUpload({
  mode,
  questionId,
  value,
  onChange,
  onFileUpload,
  onSubmit,
  allowedFileTypes,
  maxFiles = 1,
  maxSize,
  className,
}: UnifiedFileUploadProps) {
  const { files, error, uploading, inputProps, browseProps, clear } =
    useFileUpload({
      value,
      onChange,
      onFileUpload,
      onSubmit,
      questionId,
      allowedFileTypes,
      maxFiles,
      maxSize,
    });

  return (
    <div className={["w-full max-w-2xl", className].filter(Boolean).join(" ")}>
      <div
        className={[
          "border-2 border-dashed rounded-lg p-6",
          uploading ? "opacity-70" : "",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Drag & drop or</p>
            <button type="button" className="underline" {...browseProps}>
              browse
            </button>
          </div>
          {uploading && (
            <span className="h-4 w-4 inline-block animate-spin border-b-2 border-foreground rounded-full" />
          )}
        </div>
        <input {...inputProps} />
        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((f) => (
              <li
                key={f.name}
                className="flex items-center justify-between text-sm"
              >
                <span className="truncate">{f.name}</span>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={clear}
                  aria-label="Remove file"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-destructive mt-2">{error}</p>}
      </div>
    </div>
  );
}

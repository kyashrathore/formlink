"use client";
import * as React from "react";

export type UseFileUploadOptions = {
  value?: File | null;
  onChange?: (file: File | File[] | null) => void;
  onFileUpload?:
    | ((files: File[]) => Promise<void>)
    | ((questionId: string, file: File) => Promise<void>);
  onSubmit?: () => void | Promise<void>;
  questionId?: string;
  allowedFileTypes?: string[];
  maxFiles?: number;
  maxSize?: number; // bytes
};

function isQuestionScopedUploadHandler(
  handler: NonNullable<UseFileUploadOptions["onFileUpload"]>,
): handler is (questionId: string, file: File) => Promise<void> {
  return handler.length > 1;
}

export function useFileUpload(opts: UseFileUploadOptions) {
  const {
    value,
    onChange,
    onFileUpload,
    onSubmit,
    questionId,
    allowedFileTypes,
    maxFiles = 1,
    maxSize,
  } = opts;
  const [files, setFiles] = React.useState<File[]>(value ? [value] : []);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (value) setFiles([value]);
    else if (!value) setFiles([]);
  }, [value]);

  const validate = (list: File[]): string | null => {
    if (maxFiles && list.length > maxFiles)
      return `Select up to ${maxFiles} file${maxFiles > 1 ? "s" : ""}`;
    if (maxSize) {
      for (const f of list) if (f.size > maxSize) return `File too large`;
    }
    if (allowedFileTypes && allowedFileTypes.length > 0) {
      const ok = new Set(allowedFileTypes.map((s) => s.toLowerCase()));
      for (const f of list) {
        const ext = f.name.split(".").pop()?.toLowerCase();
        if (ext && !ok.has(ext) && !ok.has(f.type.toLowerCase()))
          return `Invalid file type`;
      }
    }
    return null;
  };

  const startUpload = async (list: File[]) => {
    if (!onFileUpload) return;
    setUploading(true);
    try {
      if (questionId && isQuestionScopedUploadHandler(onFileUpload)) {
        const firstFile = list[0];
        if (!firstFile) return;
        await onFileUpload(questionId, firstFile);
      } else if (!isQuestionScopedUploadHandler(onFileUpload)) {
        await onFileUpload(list);
      } else {
        throw new Error(
          "useFileUpload received a question-scoped upload handler but no questionId.",
        );
      }
    } finally {
      setUploading(false);
      await onSubmit?.();
    }
  };

  const onInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fl = Array.from(e.target.files || []);
    const err = validate(fl);
    setError(err);
    if (err) return;
    setFiles(fl);
    onChange?.(maxFiles === 1 ? (fl[0] ?? null) : fl);
    if (fl.length > 0) await startUpload(fl);
  };

  const browseProps = {
    onClick: () => inputRef.current?.click(),
  } as const;

  const inputProps = {
    ref: inputRef,
    type: "file",
    onChange: onInputChange,
    hidden: true,
    multiple: maxFiles > 1,
  } as const;

  const clear = () => {
    setFiles([]);
    onChange?.(null);
    setError(null);
  };

  return { files, error, uploading, inputProps, browseProps, clear } as const;
}

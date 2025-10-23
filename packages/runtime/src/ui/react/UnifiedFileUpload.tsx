"use client";
import * as React from "react";

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
  const [files, setFiles] = React.useState<File[]>(value ? [value] : []);
  const [error, setError] = React.useState<string | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    if (value) setFiles([value]);
    else if (!value) setFiles([]);
  }, [value]);

  const handlePick = () => inputRef.current?.click();
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
      if (onFileUpload.length === 2 && questionId) {
        await (onFileUpload as any)(questionId, list[0]!);
      } else {
        await (onFileUpload as any)(list);
      }
    } finally {
      setUploading(false);
      onSubmit?.();
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
            <button type="button" className="underline" onClick={handlePick}>
              browse
            </button>
          </div>
          {uploading && (
            <span className="h-4 w-4 inline-block animate-spin border-b-2 border-foreground rounded-full" />
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          onChange={onInputChange}
          hidden
          multiple={maxFiles > 1}
        />
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
                  onClick={() => {
                    setFiles([]);
                    onChange?.(null);
                    setError(null);
                  }}
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

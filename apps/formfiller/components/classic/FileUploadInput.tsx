"use client";

import { useState, useCallback, useEffect } from "react";
import { Upload, File, X, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@formlink/ui/lib/utils";
import { Button } from "@formlink/ui";

interface FileUploadInputProps {
  value?: { url: string; name: string; size: number } | null;
  onChange: (value: { url: string; name: string; size: number } | null) => void;
  onFileUpload?: (file: File) => Promise<string | null>;
  disabled?: boolean;
  accept?: string;
  maxSize?: number;
}

export default function FileUploadInput({
  value,
  onChange,
  onFileUpload,
  disabled = false,
  accept = "*",
  maxSize = 5 * 1024 * 1024, // 5MB default
}: FileUploadInputProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const handleFileSelect = useCallback(
    async (file: File) => {
      if (!file || disabled || isUploading) return;

      // Validate file size
      if (file.size > maxSize) {
        setUploadError(
          `File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`,
        );
        return;
      }

      setUploadError(null);
      setIsUploading(true);

      try {
        if (onFileUpload) {
          const url = await onFileUpload(file);
          if (url) {
            onChange({
              url,
              name: file.name,
              size: file.size,
            });
          } else {
            setUploadError("Failed to upload file");
          }
        } else {
          // If no upload handler, just store file info
          onChange({
            url: URL.createObjectURL(file),
            name: file.name,
            size: file.size,
          });
        }
      } catch (error) {
        setUploadError(
          error instanceof Error ? error.message : "Upload failed",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [disabled, isUploading, maxSize, onFileUpload, onChange],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0 && files[0]) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0 && files[0]) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect],
  );

  const handleRemove = useCallback(() => {
    onChange(null);
    setUploadError(null);
  }, [onChange]);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return Math.round(bytes / (1024 * 1024)) + " MB";
  };

  return (
    <div className="w-full">
      {!value || value === undefined ? (
        <div
          className={cn(
            "relative rounded-lg border-2 border-dashed transition-all duration-200",
            isDragging
              ? "border-primary bg-primary/5"
              : uploadError
                ? "border-destructive bg-destructive/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50",
            disabled && "opacity-50 cursor-not-allowed",
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            type="file"
            accept={accept}
            onChange={handleInputChange}
            disabled={disabled || isUploading}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          />

          <div
            className={cn(
              "flex flex-col items-center justify-center text-center",
              isMobile ? "p-6" : "p-8",
            )}
          >
            {isUploading ? (
              <>
                <div
                  className={cn(
                    "animate-spin rounded-full border-b-2 border-primary",
                    isMobile ? "h-8 w-8" : "h-10 w-10",
                  )}
                />
                <p
                  className={cn(
                    "mt-4 text-muted-foreground",
                    isMobile ? "text-xs" : "text-sm",
                  )}
                >
                  Uploading...
                </p>
              </>
            ) : (
              <>
                <Upload
                  className={cn(
                    uploadError ? "text-destructive" : "text-muted-foreground",
                    isMobile ? "h-8 w-8" : "h-10 w-10",
                  )}
                />
                <p
                  className={cn(
                    "mt-4 font-medium",
                    isMobile ? "text-xs" : "text-sm",
                  )}
                >
                  {isMobile
                    ? "Tap to upload"
                    : "Drop file here or click to browse"}
                </p>
                <p
                  className={cn(
                    "mt-1 text-muted-foreground",
                    isMobile ? "text-[10px]" : "text-xs",
                  )}
                >
                  Max file size: {Math.round(maxSize / 1024 / 1024)}MB
                </p>
                {uploadError && (
                  <div
                    className={cn(
                      "mt-3 flex items-center gap-2 text-destructive",
                      isMobile ? "text-xs" : "text-sm",
                    )}
                  >
                    <AlertCircle className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
                    {uploadError}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div
          className={cn("rounded-lg border bg-card", isMobile ? "p-3" : "p-4")}
        >
          <div className="flex items-center justify-between">
            <div
              className={cn("flex items-center", isMobile ? "gap-2" : "gap-3")}
            >
              <div
                className={cn(
                  "rounded-lg bg-primary/10",
                  isMobile ? "p-1.5" : "p-2",
                )}
              >
                <File
                  className={
                    isMobile ? "h-4 w-4 text-primary" : "h-5 w-5 text-primary"
                  }
                />
              </div>
              <div className={isMobile ? "max-w-[60%]" : ""}>
                <p
                  className={cn(
                    "font-medium truncate",
                    isMobile ? "text-xs" : "text-sm",
                  )}
                >
                  {value.name}
                </p>
                <p
                  className={cn(
                    "text-muted-foreground",
                    isMobile ? "text-[10px]" : "text-xs",
                  )}
                >
                  {formatFileSize(value.size)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2
                className={
                  isMobile ? "h-3 w-3 text-green-500" : "h-4 w-4 text-green-500"
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                disabled={disabled}
                className={isMobile ? "h-6 w-6 p-0" : "h-8 w-8 p-0"}
              >
                <X className={isMobile ? "h-3 w-3" : "h-4 w-4"} />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

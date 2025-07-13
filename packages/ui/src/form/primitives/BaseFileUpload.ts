import { useState, useCallback, useEffect, useRef } from "react";
import {
  BasePrimitiveProps,
  BasePrimitiveReturn,
  ValidationError,
} from "./types";

export interface FileInfo {
  file: File;
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  preview?: string;
  progress?: number;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

export interface BaseFileUploadProps extends BasePrimitiveProps<FileInfo[]> {
  /**
   * Accepted file types (e.g., 'image/*', '.pdf', etc.)
   */
  accept?: string;

  /**
   * Maximum file size in bytes
   */
  maxSize?: number;

  /**
   * Maximum number of files
   */
  maxFiles?: number;

  /**
   * Whether multiple files can be selected
   */
  multiple?: boolean;

  /**
   * Enable drag and drop
   */
  enableDragDrop?: boolean;

  /**
   * Custom upload handler
   */
  onUpload?: (file: File) => Promise<void>;

  /**
   * Callback on file remove
   */
  onRemove?: (fileId: string) => void;

  /**
   * Callback on drop
   */
  onDrop?: (files: File[]) => void;

  /**
   * Generate preview URLs for images
   */
  generatePreviews?: boolean;
}

export interface BaseFileUploadReturn extends BasePrimitiveReturn<FileInfo[]> {
  /**
   * Whether drag is active
   */
  isDragActive: boolean;

  /**
   * Add files to the list
   */
  addFiles: (files: File[]) => void;

  /**
   * Remove a file by ID
   */
  removeFile: (fileId: string) => void;

  /**
   * Upload a specific file
   */
  uploadFile: (fileId: string) => Promise<void>;

  /**
   * Upload all pending files
   */
  uploadAll: () => Promise<void>;

  /**
   * Retry failed upload
   */
  retryUpload: (fileId: string) => Promise<void>;

  /**
   * Props for the file input element
   */
  inputProps: React.InputHTMLAttributes<HTMLInputElement>;

  /**
   * Props for the drop zone
   */
  dropZoneProps: React.HTMLAttributes<HTMLElement>;

  /**
   * Open file dialog
   */
  openFileDialog: () => void;
}

export function BaseFileUpload(
  props: BaseFileUploadProps,
): BaseFileUploadReturn {
  const {
    value,
    onChange,
    disabled = false,
    required = false,
    onValidate,
    onValidationChange,
    autoFocus = false,
    id,
    name,
    ariaLabel,
    ariaDescribedBy,
    accept,
    maxSize,
    maxFiles,
    multiple = false,
    enableDragDrop = true,
    onUpload,
    onRemove,
    onDrop,
    generatePreviews = true,
  } = props;

  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [isTouched, setIsTouched] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragCounter = useRef(0);

  // Validate files
  const validate = useCallback(() => {
    const validationErrors: ValidationError[] = [];

    // Required validation
    if (required && value.length === 0) {
      validationErrors.push({
        type: "required",
        message: "Please select at least one file",
      });
    }

    // Max files validation
    if (maxFiles && value.length > maxFiles) {
      validationErrors.push({
        type: "maxFiles",
        message: `Maximum ${maxFiles} file${maxFiles > 1 ? "s" : ""} allowed`,
      });
    }

    // File validation
    value.forEach((fileInfo) => {
      // Size validation
      if (maxSize && fileInfo.size > maxSize) {
        validationErrors.push({
          type: "fileSize",
          message: `${fileInfo.name} exceeds maximum size of ${formatFileSize(maxSize)}`,
        });
      }

      // Type validation
      if (accept && !isAcceptedType(fileInfo.file, accept)) {
        validationErrors.push({
          type: "fileType",
          message: `${fileInfo.name} is not an accepted file type`,
        });
      }
    });

    // Custom validation
    if (onValidate) {
      const customErrors = onValidate(value);
      validationErrors.push(...customErrors);
    }

    setErrors(validationErrors);
    onValidationChange?.(validationErrors);

    return validationErrors;
  }, [
    value,
    required,
    maxFiles,
    maxSize,
    accept,
    onValidate,
    onValidationChange,
  ]);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Validate when touched and value changes
  useEffect(() => {
    if (isTouched) {
      validate();
    }
  }, [value, isTouched, validate]);

  // Clean up preview URLs
  useEffect(() => {
    return () => {
      if (value && Array.isArray(value)) {
        value.forEach((fileInfo) => {
          if (fileInfo.preview && fileInfo.preview.startsWith("blob:")) {
            URL.revokeObjectURL(fileInfo.preview);
          }
        });
      }
    };
  }, [value]);

  const generateFileInfo = useCallback(
    async (file: File): Promise<FileInfo> => {
      const fileInfo: FileInfo = {
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        status: "pending",
      };

      // Generate preview for images
      if (generatePreviews && file.type.startsWith("image/")) {
        fileInfo.preview = URL.createObjectURL(file);
      }

      return fileInfo;
    },
    [generatePreviews],
  );

  const addFiles = useCallback(
    async (files: File[]) => {
      if (disabled) return;

      // Filter files if we have a max limit
      let filesToAdd = files;
      if (maxFiles) {
        const remaining = maxFiles - value.length;
        if (remaining <= 0) return;
        filesToAdd = files.slice(0, remaining);
      }

      // Generate file info for each file
      const newFileInfos = await Promise.all(filesToAdd.map(generateFileInfo));

      onChange([...value, ...newFileInfos]);
      setIsTouched(true);
    },
    [disabled, maxFiles, value, onChange, generateFileInfo],
  );

  const removeFile = useCallback(
    (fileId: string) => {
      if (disabled) return;

      const fileInfo = value.find((f) => f.id === fileId);
      if (fileInfo) {
        // Clean up preview URL
        if (fileInfo.preview && fileInfo.preview.startsWith("blob:")) {
          URL.revokeObjectURL(fileInfo.preview);
        }

        onChange(value.filter((f) => f.id !== fileId));
        onRemove?.(fileId);
      }
    },
    [disabled, value, onChange, onRemove],
  );

  const uploadFile = useCallback(
    async (fileId: string) => {
      if (!onUpload) return;

      const fileInfo = value.find((f) => f.id === fileId);
      if (!fileInfo || fileInfo.status === "uploading") return;

      // Update status to uploading
      onChange(
        value.map((f) =>
          f.id === fileId
            ? { ...f, status: "uploading" as const, progress: 0 }
            : f,
        ),
      );

      try {
        await onUpload(fileInfo.file);

        // Update status to success
        onChange(
          value.map((f) =>
            f.id === fileId
              ? { ...f, status: "success" as const, progress: 100 }
              : f,
          ),
        );
      } catch (error) {
        // Update status to error
        onChange(
          value.map((f) =>
            f.id === fileId
              ? {
                  ...f,
                  status: "error" as const,
                  error:
                    error instanceof Error ? error.message : "Upload failed",
                }
              : f,
          ),
        );
      }
    },
    [value, onChange, onUpload],
  );

  const uploadAll = useCallback(async () => {
    const pendingFiles = value.filter((f) => f.status === "pending");
    await Promise.all(pendingFiles.map((f) => uploadFile(f.id)));
  }, [value, uploadFile]);

  const retryUpload = useCallback(
    async (fileId: string) => {
      const fileInfo = value.find((f) => f.id === fileId);
      if (fileInfo && fileInfo.status === "error") {
        // Reset status to pending
        onChange(
          value.map((f) =>
            f.id === fileId
              ? { ...f, status: "pending" as const, error: undefined }
              : f,
          ),
        );

        await uploadFile(fileId);
      }
    },
    [value, onChange, uploadFile],
  );

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (files.length > 0) {
        addFiles(files);
      }

      // Reset input value to allow selecting the same file again
      event.target.value = "";
    },
    [addFiles],
  );

  const handleDragEnter = useCallback(
    (event: React.DragEvent) => {
      if (!enableDragDrop || disabled) return;

      event.preventDefault();
      event.stopPropagation();

      dragCounter.current++;
      if (event.dataTransfer.items && event.dataTransfer.items.length > 0) {
        setIsDragActive(true);
      }
    },
    [enableDragDrop, disabled],
  );

  const handleDragLeave = useCallback(
    (event: React.DragEvent) => {
      if (!enableDragDrop || disabled) return;

      event.preventDefault();
      event.stopPropagation();

      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragActive(false);
      }
    },
    [enableDragDrop, disabled],
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent) => {
      if (!enableDragDrop || disabled) return;

      event.preventDefault();
      event.stopPropagation();
    },
    [enableDragDrop, disabled],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      if (!enableDragDrop || disabled) return;

      event.preventDefault();
      event.stopPropagation();

      setIsDragActive(false);
      dragCounter.current = 0;

      const files = Array.from(event.dataTransfer.files);
      if (files.length > 0) {
        addFiles(files);
        onDrop?.(files);
      }
    },
    [enableDragDrop, disabled, addFiles, onDrop],
  );

  const openFileDialog = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const clear = useCallback(() => {
    // Clean up all preview URLs
    if (value && Array.isArray(value)) {
      value.forEach((fileInfo) => {
        if (fileInfo.preview && fileInfo.preview.startsWith("blob:")) {
          URL.revokeObjectURL(fileInfo.preview);
        }
      });
    }

    onChange([]);
    setErrors([]);
    setIsTouched(false);
  }, [value, onChange]);

  const reset = useCallback(() => {
    // Clean up all preview URLs
    if (value && Array.isArray(value)) {
      value.forEach((fileInfo) => {
        if (fileInfo.preview && fileInfo.preview.startsWith("blob:")) {
          URL.revokeObjectURL(fileInfo.preview);
        }
      });
    }

    onChange([]);
    setErrors([]);
    setIsTouched(false);
    setIsDragActive(false);
    dragCounter.current = 0;
  }, [value, onChange]);

  const containerProps: React.HTMLAttributes<HTMLElement> = {
    id: id ? `${id}-container` : undefined,
  };

  const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
    ref: inputRef,
    id,
    name,
    type: "file",
    accept,
    multiple,
    onChange: handleFileSelect,
    disabled,
    required,
    "aria-label": ariaLabel || "File upload",
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": errors.length > 0,
    "aria-required": required,
    "aria-disabled": disabled,
    style: { display: "none" }, // Hidden by default
  };

  const dropZoneProps: React.HTMLAttributes<HTMLElement> = {
    onDragEnter: handleDragEnter,
    onDragLeave: handleDragLeave,
    onDragOver: handleDragOver,
    onDrop: handleDrop,
    "aria-label": "Drop zone for file upload",
    "aria-dropeffect": isDragActive ? "copy" : "none",
  };

  return {
    value,
    errors,
    containerProps,
    isValid: errors.length === 0,
    isTouched,
    setTouched: setIsTouched,
    validate,
    clear,
    reset,
    isDragActive,
    addFiles,
    removeFile,
    uploadFile,
    uploadAll,
    retryUpload,
    inputProps,
    dropZoneProps,
    openFileDialog,
  };
}

// Helper functions
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function isAcceptedType(file: File, accept: string): boolean {
  const acceptedTypes = accept.split(",").map((type) => type.trim());

  return acceptedTypes.some((type) => {
    if (type.startsWith(".")) {
      // Extension check
      return file.name.toLowerCase().endsWith(type.toLowerCase());
    } else if (type.endsWith("/*")) {
      // MIME type wildcard check
      const baseType = type.slice(0, -2);
      return file.type.startsWith(baseType);
    } else {
      // Exact MIME type check
      return file.type === type;
    }
  });
}

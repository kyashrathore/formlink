"use client";

import React, { useCallback, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BaseFileUpload, FileInfo } from '../../primitives/BaseFileUpload';
import { cn } from '../../../lib/utils';
import { Button } from '../../../ui/button';
import { X, File, ArrowRight } from 'lucide-react';
import { Dropzone, DropzoneContent, DropzoneEmptyState } from '../../../ui/kibo-ui/dropzone';

export type FormMode = 'chat' | 'typeform';

export interface UnifiedFileUploadProps {
  mode: FormMode;
  value?: File[] | null;
  onChange?: (file: File | File[] | null) => void;
  onFileSelect?: (files: File[]) => void;
  onFileUpload?: (files: File[]) => Promise<void>;
  onSubmit?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  maxFiles?: number;
  maxSize?: number;
  accept?: string;
  className?: string;
  isUploading?: boolean;
  // TypeForm specific props
  questionId?: string;
  allowedFileTypes?: string[];
  uploadedFile?: File | null;
  ariaLabel?: string;
  ariaDescribedBy?: string;
}

export function UnifiedFileUpload(props: UnifiedFileUploadProps) {

  const { 
    mode,
    value,
    onChange,
    onFileSelect,
    onFileUpload,
    onSubmit, 
    disabled = false,
    maxFiles = mode === 'chat' ? 1 : 1, // Both modes default to single file
    maxSize = 5 * 1024 * 1024, // 5MB default
    accept,
    className,
    isUploading: externalIsUploading,
    // TypeForm specific
    questionId,
    allowedFileTypes,
    uploadedFile,
    ariaLabel = 'Upload file',
    ariaDescribedBy
  } = props;

  const [internalIsUploading, setInternalIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(uploadedFile || null);
  
  // Use external isUploading if provided, otherwise use internal state
  const isUploading = externalIsUploading !== undefined ? externalIsUploading : internalIsUploading;

  // Convert File[] to FileInfo[] for BaseFileUpload
  const [fileInfos, setFileInfos] = useState<FileInfo[]>([]);

  // Sync value prop to fileInfos (Chat mode)
  useEffect(() => {
    if (mode === 'chat' && value && value.length > 0) {
      const newFileInfos: FileInfo[] = value.map((file, index) => ({
        file,
        id: `${Date.now()}-${index}`,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        status: 'success' as const,
        // Fix null check bug: ensure file.type exists before calling startsWith
        preview: (file.type && file.type.startsWith('image/')) ? URL.createObjectURL(file) : undefined
      }));
      setFileInfos(newFileInfos);
    } else if (mode === 'chat') {
      setFileInfos([]);
    }
  }, [value, mode]);

  // Custom upload handler that wraps the provided onFileUpload
  const handleUpload = useCallback(async (file: File) => {

    if (onFileUpload) {
      setInternalIsUploading(true);
      setUploadError(null);
      try {
        if (mode === 'typeform' && questionId) {
          // TypeForm expects questionId as first parameter
          await (onFileUpload as (questionId: string, file: File) => Promise<void>)(questionId, file);
        } else {
          await onFileUpload([file]);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Upload failed';
        setUploadError(errorMsg);
        props.onError?.(errorMsg);
        throw err; // Re-throw so BaseFileUpload updates status
      } finally {
        setInternalIsUploading(false);
      }
    } else {
      console.warn("[UnifiedFileUpload] handleUpload called but onFileUpload is undefined");
    }
  }, [onFileUpload, props.onError, mode, questionId]);

  // Handle file drop (TypeForm mode) - restore original working logic
  const handleDrop = async (acceptedFiles: File[]) => {

    if (disabled || isUploading || acceptedFiles.length === 0) return;
    
    const file = acceptedFiles[0]; // TypeForm style - single file only
    if (!file) return;
    setError(null);
    setSelectedFile(file);
    onFileSelect?.([file]);
    
    // TypeForm onChange expects single file
    if (file) {
      onChange?.(file);
    }
    
    try {
      
      if (questionId) {
        await (onFileUpload as (questionId: string, file: File) => Promise<void>)?.(questionId, file);
      }
      
      // Don't auto-submit here, let the parent handle submission
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      onFileSelect?.([]);
      setSelectedFile(null);
    }
  };

  // Use BaseFileUpload hook for Chat mode only (preserve TypeForm behavior)
  const baseFileUpload = mode === 'chat' ? BaseFileUpload({
    value: fileInfos,
    onChange: (newFileInfos) => {
      setFileInfos(newFileInfos);
      
      // Extract files from FileInfo objects
      const files = newFileInfos.map(fi => fi.file);
      
      // Call appropriate onChange handler
      if (maxFiles === 1 && files.length > 0) {
        onChange?.(files[0]);
      } else if (files.length > 0) {
        onChange?.(files);
      } else {
        onChange?.(null);
      }
      
      // Call onFileSelect if provided
      onFileSelect?.(files);
    },
    disabled: disabled || isUploading,
    maxFiles,
    maxSize,
    accept,
    multiple: maxFiles > 1,
    enableDragDrop: true,
    onUpload: handleUpload,
    generatePreviews: true,
  }) : null;

  const setError = (error: string | null) => {
    setUploadError(error);
  };

  const handleRemoveFile = useCallback((fileInfo?: FileInfo) => {
    if (mode === 'chat' && baseFileUpload && fileInfo) {
      baseFileUpload.removeFile(fileInfo.id);
    } else {
      // TypeForm mode - restore original logic
      setSelectedFile(null);
      onChange?.(null);
      onFileSelect?.([]);
      setError(null);
    }
  }, [baseFileUpload, mode, onChange, onFileSelect]);

  // Get current files for display (mode-specific)
  const currentFiles = mode === 'chat' ? (baseFileUpload?.value || []) : [];
  const currentFile = mode === 'typeform' ? (selectedFile || uploadedFile) : null;

  // Combine errors from BaseFileUpload and upload errors (mode-specific)
  const displayError = uploadError || (mode === 'chat' && baseFileUpload?.errors && baseFileUpload.errors.length > 0 ? baseFileUpload.errors[0].message : null);

  // TypeForm specific accepted types
  const acceptedTypes = allowedFileTypes ? allowedFileTypes.reduce((acc, type) => {
    acc[type] = [];
    return acc;
  }, {} as Record<string, string[]>) : undefined;

  if (mode === 'typeform') {
    // TypeForm layout
    return (
      <motion.div 
        className={cn("space-y-6 w-full max-w-2xl", className)}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Dropzone
          onDrop={handleDrop}
          accept={acceptedTypes}
          maxFiles={1}
          maxSize={maxSize}
          disabled={disabled || isUploading}
          src={currentFile ? [currentFile] : undefined}
          className={cn(
            "min-h-48 transition-all duration-300 border-2 border-border",
            disabled && "opacity-50 cursor-not-allowed",
            "hover:border-primary hover:bg-accent/50"
          )}
          aria-label={ariaLabel}
          aria-describedby={ariaDescribedBy || `${questionId}-instructions`}
          role="region"
        >
          <DropzoneEmptyState className="space-y-4">
            <div className="text-left space-y-2">
              <p className="text-lg font-medium" id={`${questionId}-instructions`}>
                Upload your file
              </p>
              <p className="text-sm text-muted-foreground">
                Drag and drop or click to browse
              </p>
              {maxSize && (
                <p className="text-xs text-muted-foreground">
                  Max file size: {(maxSize / 1024 / 1024).toFixed(1)}MB
                </p>
              )}
              {allowedFileTypes && allowedFileTypes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Accepted types: {allowedFileTypes.join(', ')}
                </p>
              )}
            </div>
          </DropzoneEmptyState>
          <DropzoneContent />
        </Dropzone>

        {displayError && (
          <motion.div 
            className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-left"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            role="alert"
            aria-live="assertive"
          >
            {displayError}
          </motion.div>
        )}

        {currentFile && (
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
          >
            <div className="flex items-center gap-4 p-4 bg-accent/50 rounded-lg border">
              {/* Fix null check bug: ensure currentFile.type exists before calling startsWith */}
              {(currentFile?.type && currentFile.type.startsWith('image/')) ? (
                <img 
                  src={URL.createObjectURL(currentFile)} 
                  alt={currentFile.name}
                  className="w-16 h-16 object-cover rounded-lg"
                />
              ) : (
                <div className="w-16 h-16 flex items-center justify-center bg-background rounded-lg border">
                  <File className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{currentFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(currentFile.size / 1024).toFixed(1)}KB
                </p>
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveFile()}
                disabled={disabled || isUploading}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${currentFile.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {onSubmit && !isUploading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, delay: 0.2 }}
              >
                <Button
                  onClick={onSubmit}
                  disabled={disabled}
                  className="w-full"
                  size="lg"
                >
                  Continue
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
        
        {isUploading && (
          <motion.div 
            className="py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" aria-hidden="true"></div>
              <span className="text-sm text-muted-foreground">Uploading...</span>
            </div>
            <div className="w-full bg-accent rounded-full h-2 mt-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={100}>
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: '100%' }}
              />
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  }

  // Chat mode layout
  if (!baseFileUpload) return null;
  
  const {
    isDragActive,
    inputProps,
    dropZoneProps,
    openFileDialog
  } = baseFileUpload;

  return (
    <motion.div 
      className={cn("space-y-6", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="relative">
        <input
          {...inputProps}
          className="sr-only"
        />
        <label
          htmlFor={inputProps.id}
          {...dropZoneProps}
          onClick={(e) => {
            // Prevent default to avoid conflicts with drag and drop
            e.preventDefault();
            // Manually trigger file dialog
            if (!disabled && !isUploading) {
              openFileDialog();
            }
          }}
          className={cn(
            "block w-full p-8 border-2 border-dashed rounded-lg text-center cursor-pointer transition-all duration-300",
            "hover:border-primary hover:bg-accent/50",
            isDragActive && "border-primary bg-accent/50",
            disabled && "opacity-50 cursor-not-allowed",
            "min-h-32"
          )}
        >
          <div className="text-center space-y-1">
            <p className="text-base font-medium">
              Upload files
            </p>
            <p className="text-xs text-muted-foreground">
              Drag and drop or click to browse
            </p>
            {maxSize && (
              <p className="text-xs text-muted-foreground">
                Max: {(maxSize / 1024 / 1024).toFixed(1)}MB each
              </p>
            )}
          </div>
        </label>
      </div>

      {displayError && (
        <motion.div 
          className="text-sm text-red-500 bg-red-50 border border-red-200 rounded-lg p-3"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {displayError}
        </motion.div>
      )}

      {currentFiles.length > 0 && (
        <motion.div 
          className="space-y-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {currentFiles.map((fileInfo) => (
            <div key={fileInfo.id} className="flex items-center gap-3 p-3 bg-accent/50 rounded-lg border">
              {fileInfo.preview ? (
                <img 
                  src={fileInfo.preview} 
                  alt={fileInfo.name}
                  className="w-12 h-12 object-cover rounded-lg"
                />
              ) : (fileInfo.type && fileInfo.type.startsWith('image/')) ? (
                <img 
                  src={URL.createObjectURL(fileInfo.file)} 
                  alt={fileInfo.name}
                  className="w-12 h-12 object-cover rounded-lg"
                />
              ) : (
                <div className="w-12 h-12 flex items-center justify-center bg-background rounded-lg border">
                  <File className="h-6 w-6 text-muted-foreground" />
                </div>
              )}
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{fileInfo.name}</p>
                <p className="text-xs text-muted-foreground">
                  {fileInfo.type.split('/')[1]?.toUpperCase() || 'FILE'} • {(fileInfo.size / 1024).toFixed(1)}KB
                </p>
                {fileInfo.status === 'error' && fileInfo.error && (
                  <p className="text-xs text-red-500">{fileInfo.error}</p>
                )}
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemoveFile(fileInfo)}
                disabled={disabled || isUploading}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${fileInfo.name}`}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
          
          {onSubmit && !isUploading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Button
                onClick={onSubmit}
                disabled={disabled}
                className="w-full group"
                size="lg"
              >
                Continue with {currentFiles.length} file{currentFiles.length > 1 ? 's' : ''}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </motion.div>
          )}
        </motion.div>
      )}
      
      {isUploading && (
        <motion.div 
          className="flex items-center justify-center py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-sm text-muted-foreground">Uploading...</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
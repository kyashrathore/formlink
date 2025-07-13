/**
 * File validation utilities for UI components.
 * Pure utility functions with no database dependencies.
 */

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

export type Attachment = {
  name: string
  contentType: string
  url: string
}

export function validateFile(file: File): { isValid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    }
  }

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      isValid: false,
      error: "File type not supported",
    }
  }

  return { isValid: true }
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string | undefined {
  return filename.split(".").pop()
}

/**
 * Generate a random filename while preserving extension
 */
export function generateRandomFilename(originalFilename: string): string {
  const fileExt = getFileExtension(originalFilename)
  const randomName = Math.random().toString(36).substring(2)
  return `${randomName}.${fileExt}`
}

/**
 * Create attachment object from file and URL
 */
export function createAttachment(file: File, url: string): Attachment {
  return {
    name: file.name,
    contentType: file.type,
    url: url,
  }
}

/**
 * Get file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Check if file type is an image
 */
export function isImageFile(fileType: string): boolean {
  return fileType.startsWith('image/')
}

/**
 * Get maximum file size in bytes
 */
export function getMaxFileSize(): number {
  return MAX_FILE_SIZE
}

/**
 * Get allowed file types
 */
export function getAllowedFileTypes(): string[] {
  return [...ALLOWED_FILE_TYPES]
}

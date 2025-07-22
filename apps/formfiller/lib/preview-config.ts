/**
 * Preview mode configuration utilities for FormFiller app.
 * Handles environment-aware origin validation and preview settings.
 */

/**
 * Get allowed origins for preview mode postMessage communication
 */
export function getAllowedPreviewOrigins(): string[] {
  const allowedOrigins = process.env.NEXT_PUBLIC_ALLOWED_PREVIEW_ORIGINS;

  if (allowedOrigins) {
    return allowedOrigins.split(",").map((origin) => origin.trim());
  }

  // Default fallback origins based on environment
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    return [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
    ];
  }

  // Production fallback - should be configured via environment variables
  return [
    "https://app.formcraft.com",
    "https://formcraft.com",
    "https://formlink.ai",
  ];
}

/**
 * Validate if an origin is allowed for preview mode communication
 */
export function validatePreviewOrigin(origin: string): boolean {
  const allowedOrigins = getAllowedPreviewOrigins();
  return allowedOrigins.includes(origin);
}

/**
 * Preview configuration object with helper methods
 */
export const previewConfig = {
  /**
   * Get allowed origins for preview mode
   */
  getAllowedOrigins: getAllowedPreviewOrigins,

  /**
   * Validate origin for preview mode
   */
  validateOrigin: validatePreviewOrigin,

  /**
   * Get preview timeout duration (in milliseconds)
   */
  getTimeoutDuration: (): number => {
    const timeout = process.env.NEXT_PUBLIC_PREVIEW_TIMEOUT_MS;
    return timeout ? parseInt(timeout, 10) : 5000; // 5 seconds default
  },

  /**
   * Check if debug mode is enabled for preview
   */
  isDebugMode: (): boolean => {
    return (
      process.env.NODE_ENV === "development" ||
      process.env.NEXT_PUBLIC_PREVIEW_DEBUG === "true"
    );
  },
};

/**
 * Simple API configuration utility for FormLink app.
 * Centralizes URL construction to eliminate environment logic duplication.
 */

import {
  SaveAnswersRequest,
  SaveAnswersResponse,
  UploadResponse,
} from "./types";

/**
 * Get the base API URL based on environment
 * In production, formfiller is proxied through /f/* from formcraft
 */
function getBaseApiUrl(): string {
  // Check if we're running on localhost (local development)
  if (typeof window !== "undefined") {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    // If on localhost, use direct API routes
    if (isLocalhost) {
      return "";
    }
  }

  // In production or when accessed through formcraft, use /f prefix
  // This handles both forms.formlink.ai (no prefix needed) and formlink.ai/f/* (prefix needed)
  const needsPrefix =
    typeof window !== "undefined" && window.location.pathname.startsWith("/f/");

  return needsPrefix ? "/f" : "";
}

/**
 * API configuration object with simple helper methods
 */
export const apiConfig = {
  /**
   * Get API endpoint URL
   */
  getApiUrl: (endpoint: string): string => {
    return `${getBaseApiUrl()}${endpoint}`;
  },

  /**
   * Get upload API URL
   */
  getUploadUrl: (): string => {
    return `${getBaseApiUrl()}/api/upload`;
  },

  /**
   * Get save answers API URL
   */
  getSaveAnswersUrl: (formId: string): string => {
    return `${getBaseApiUrl()}/api/forms/${formId}/save-answers`;
  },

  /**
   * Get chat assist API URL
   */
  getChatAssistUrl: (): string => {
    return `${getBaseApiUrl()}/api/ai/chat-assist`;
  },
};

/**
 * Simple service utility functions for common API operations
 */
export const apiServices = {
  /**
   * Upload file to server
   */
  uploadFile: async (formData: FormData): Promise<UploadResponse> => {
    const response = await fetch(apiConfig.getUploadUrl(), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "File upload failed";
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If response is not JSON, use status text
        errorMessage = `${errorMessage}: ${response.statusText} (${response.status})`;
      }
      throw new Error(errorMessage);
    }

    return response.json();
  },

  /**
   * Save form answers to server
   */
  saveAnswers: async (
    formId: string,
    payload: SaveAnswersRequest,
  ): Promise<SaveAnswersResponse> => {
    const response = await fetch(apiConfig.getSaveAnswersUrl(formId), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error("Failed to save answers.");
    }

    return response.json();
  },
};

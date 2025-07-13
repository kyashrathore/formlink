/**
 * Simple API configuration utility for FormLink app.
 * Centralizes URL construction to eliminate environment logic duplication.
 */

/**
 * Get the base API URL based on environment
 */
function getBaseApiUrl(): string {
  return process.env.NODE_ENV === "development" ? "" : "/f";
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
  uploadFile: async (formData: FormData): Promise<any> => {
    const response = await fetch(apiConfig.getUploadUrl(), {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("File upload failed.");
    }

    return response.json();
  },

  /**
   * Save form answers to server
   */
  saveAnswers: async (formId: string, payload: any): Promise<any> => {
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

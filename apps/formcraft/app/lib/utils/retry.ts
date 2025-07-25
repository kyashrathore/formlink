interface RetryOptions {
  maxAttempts: number;
  delay: number;
  backoff?: "fixed" | "exponential" | "linear";
  maxDelay?: number;
  retryCondition?: (error: Error) => boolean;
}

export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const {
    maxAttempts,
    delay,
    backoff = "exponential",
    maxDelay = 30000,
    retryCondition = () => true,
  } = options;

  let lastError: Error;
  let currentDelay = delay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on the last attempt or if retry condition fails
      if (attempt === maxAttempts || !retryCondition(lastError)) {
        throw lastError;
      }

      // Wait before retrying
      if (currentDelay > 0) {
        await sleep(Math.min(currentDelay, maxDelay));
      }

      // Calculate next delay based on backoff strategy
      switch (backoff) {
        case "exponential":
          currentDelay = currentDelay * 2;
          break;
        case "linear":
          currentDelay = currentDelay + delay;
          break;
        case "fixed":
        default:
          // Keep the same delay
          break;
      }

      console.log(
        `Retry attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${currentDelay}ms...`,
      );
    }
  }

  throw lastError!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Common retry conditions
export const retryConditions = {
  // Retry on network errors
  networkErrors: (error: Error): boolean => {
    const networkErrorKeywords = [
      "ECONNRESET",
      "ENOTFOUND",
      "ECONNREFUSED",
      "ETIMEDOUT",
      "fetch failed",
      "network error",
      "timeout",
    ];
    return networkErrorKeywords.some((keyword) =>
      error.message.toLowerCase().includes(keyword.toLowerCase()),
    );
  },

  // Retry on HTTP 5xx errors
  serverErrors: (error: Error): boolean => {
    const statusMatch = error.message.match(/status (\d+)/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      return status >= 500 && status < 600;
    }
    return false;
  },

  // Retry on rate limit errors (usually 429)
  rateLimitErrors: (error: Error): boolean => {
    return error.message.toLowerCase().includes("rate limit") ||
           error.message.includes("429");
  },

  // Combine multiple conditions
  combine: (...conditions: Array<(error: Error) => boolean>) => {
    return (error: Error): boolean => {
      return conditions.some((condition) => condition(error));
    };
  },
};

// Predefined retry configurations
export const retryConfigs = {
  // Quick retries for transient failures
  quick: {
    maxAttempts: 3,
    delay: 1000,
    backoff: "exponential" as const,
    maxDelay: 5000,
  },

  // Standard retries for most operations
  standard: {
    maxAttempts: 3,
    delay: 2000,
    backoff: "exponential" as const,
    maxDelay: 10000,
  },

  // Patient retries for critical operations
  patient: {
    maxAttempts: 5,
    delay: 5000,
    backoff: "exponential" as const,
    maxDelay: 30000,
  },
};
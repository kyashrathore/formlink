/**
 * Retrieves an environment variable in a platform-agnostic way.
 * This wrapper allows you to centralize all environment variable access,
 * making it easier to adapt to different runtimes (Node.js, Cloudflare Workers, etc).
 *
 * @param key The name of the environment variable.
 * @param defaultValue An optional default value if the variable is not set.
 * @returns The value of the environment variable, or the default value if provided, or undefined.
 */
export function getenv<T = string>(
  key: string,
  defaultValue?: T
): T | undefined {
  if (typeof process !== "undefined" && process.env) {
    const value = process.env[key]
    if (value !== undefined) {
      return value as T
    }
  }
  // Placeholder for other environments (e.g., Cloudflare Workers)
  // Adapt this function as needed for other platforms.
  return defaultValue
}

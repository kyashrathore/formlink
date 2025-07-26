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
  return defaultValue
}

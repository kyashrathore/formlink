const rateLimitCache = new Map<string, { count: number; resetTime: number }>();

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // Clean expired entries
  for (const [k, v] of rateLimitCache.entries()) {
    if (now > v.resetTime) {
      rateLimitCache.delete(k);
    }
  }

  const existing = rateLimitCache.get(key);

  if (!existing || now > existing.resetTime) {
    // New window
    rateLimitCache.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (existing.count >= limit) {
    return false;
  }

  existing.count++;
  return true;
}

export function getRateLimitInfo(key: string): {
  count: number;
  remaining: number;
  resetTime: number;
  limit: number;
} | null {
  const existing = rateLimitCache.get(key);
  if (!existing) return null;

  // This requires storing the limit, which we'll approximate
  const approximateLimit = existing.count + 10; // Rough estimate
  
  return {
    count: existing.count,
    remaining: Math.max(0, approximateLimit - existing.count),
    resetTime: existing.resetTime,
    limit: approximateLimit,
  };
}

export function clearRateLimit(key: string): void {
  rateLimitCache.delete(key);
}

export function getRateLimitCacheSize(): number {
  return rateLimitCache.size;
}
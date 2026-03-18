/**
 * Rate limiting for email sending to prevent "Rate Limit Exceeded" errors
 *
 * Uses in-memory storage for development. For production, use Redis or Upstash.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory storage (resets on server restart)
const rateLimitStore = new Map<string, RateLimitEntry>();

/**
 * Rate limit configuration
 */
const RATE_LIMIT_CONFIG = {
  // Max emails per timeframe
  MAX_EMAILS_PER_HOUR: 3,
  MAX_EMAILS_PER_DAY: 10,

  // Timeframes in milliseconds
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
};

/**
 * Clean up expired entries
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Check if email can be sent (rate limit check)
 *
 * @param email - User's email address
 * @param type - Email type (magic, reset, etc.)
 * @returns Object with { allowed: boolean, reason?: string, retryAfter?: number }
 */
export function checkRateLimit(
  email: string,
  type: string = "default"
): {
  allowed: boolean;
  reason?: string;
  retryAfter?: number; // seconds until retry
} {
  cleanupExpiredEntries();

  const key = `${type}:${email}`;
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  // First request - always allowed
  if (!entry) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_CONFIG.ONE_HOUR,
    });
    return { allowed: true };
  }

  // Check if timeframe has expired
  if (entry.resetAt < now) {
    // Reset counter
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_CONFIG.ONE_HOUR,
    });
    return { allowed: true };
  }

  // Check hourly limit
  if (entry.count >= RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return {
      allowed: false,
      reason: `Too many requests. Please try again in ${formatTime(retryAfter)}.`,
      retryAfter,
    };
  }

  // Increment counter
  entry.count++;
  return { allowed: true };
}

/**
 * Reset rate limit for a specific email (admin function)
 */
export function resetRateLimit(email: string, type: string = "default") {
  const key = `${type}:${email}`;
  rateLimitStore.delete(key);
}

/**
 * Get remaining requests for an email
 */
export function getRemainingRequests(email: string, type: string = "default"): {
  remaining: number;
  resetAt: Date;
} {
  const key = `${type}:${email}`;
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return {
      remaining: RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR,
      resetAt: new Date(Date.now() + RATE_LIMIT_CONFIG.ONE_HOUR),
    };
  }

  return {
    remaining: Math.max(0, RATE_LIMIT_CONFIG.MAX_EMAILS_PER_HOUR - entry.count),
    resetAt: new Date(entry.resetAt),
  };
}

/**
 * Format seconds into human-readable time
 */
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} minutes`;
  return `${Math.ceil(seconds / 3600)} hours`;
}

/**
 * Rate limit error message component data
 */
export function getRateLimitError(retryAfter?: number): {
  title: string;
  description: string;
} {
  if (retryAfter) {
    return {
      title: "Too many requests",
      description: `Please wait ${formatTime(retryAfter)} before requesting another email.`,
    };
  }
  return {
    title: "Too many requests",
    description: "You've reached the maximum number of email requests. Please try again later.",
  };
}

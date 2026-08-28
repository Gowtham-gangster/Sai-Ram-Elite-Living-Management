// In-memory token bucket rate limiter for administrative authentication
interface RateLimitRecord {
  attempts: number;
  resetAt: number;
}

const loginAttempts = new Map<string, RateLimitRecord>();

/**
 * Checks if an identifier (IP address or email) is rate-limited.
 * Max 5 failed attempts per 15 minutes window.
 */
export function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000
): { allowed: boolean; remainingAttempts: number; retryAfterSec: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now > record.resetAt) {
    loginAttempts.set(key, { attempts: 0, resetAt: now + windowMs });
    return { allowed: true, remainingAttempts: maxAttempts, retryAfterSec: 0 };
  }

  if (record.attempts >= maxAttempts) {
    const retryAfterSec = Math.ceil((record.resetAt - now) / 1000);
    return { allowed: false, remainingAttempts: 0, retryAfterSec };
  }

  return {
    allowed: true,
    remainingAttempts: maxAttempts - record.attempts,
    retryAfterSec: 0,
  };
}

export function recordFailedAttempt(key: string, windowMs: number = 15 * 60 * 1000) {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || now > record.resetAt) {
    loginAttempts.set(key, { attempts: 1, resetAt: now + windowMs });
  } else {
    record.attempts += 1;
  }
}

export function clearRateLimit(key: string) {
  loginAttempts.delete(key);
}

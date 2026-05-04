import { getRedis } from "./redis";

// TTLs in seconds
export const TTL = {
  CARD: 24 * 60 * 60,         // 24h — card metadata changes rarely
  PRINTINGS: 24 * 60 * 60,    // 24h
  HISTORY: 24 * 60 * 60,      // 24h — historical rows never change
  PRICE_STANDARD: 12 * 60 * 60, // 12h — standard refresh window
  PRICE_POPULAR: 4 * 60 * 60,   // 4h  — popular cards stay fresh longer
  FILTERS: 60 * 60,             // 1h
  TRENDING: 2 * 60 * 60,        // 2h
};

// Cards viewed more than this many times in 24h are considered "popular"
const POPULAR_THRESHOLD = 10;

/**
 * Generic cache-aside helper.
 * Returns cached value if present; otherwise calls fetchFn, stores the result, and returns it.
 * Falls through to fetchFn on any Redis error so the app never breaks.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  const redis = getRedis();

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached !== null) return JSON.parse(cached) as T;
    } catch {
      // Redis unavailable — fall through to DB
    }
  }

  const data = await fetchFn();

  if (redis) {
    try {
      await redis.setex(key, ttlSeconds, JSON.stringify(data));
    } catch {
      // Ignore write errors
    }
  }

  return data;
}

/**
 * Increments a per-card view counter (resets every 24h) and returns the
 * appropriate price cache TTL: shorter for popular cards, longer for others.
 */
export async function getPriceTTL(cardUniqueId: string): Promise<number> {
  const redis = getRedis();
  if (!redis) return TTL.PRICE_STANDARD;

  try {
    const key = `fab:views:${cardUniqueId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      // First view in this window — set the 24h expiry
      await redis.expire(key, 24 * 60 * 60);
    }
    return count >= POPULAR_THRESHOLD ? TTL.PRICE_POPULAR : TTL.PRICE_STANDARD;
  } catch {
    return TTL.PRICE_STANDARD;
  }
}

import Redis from "ioredis";

let client: Redis | null = null;

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;

  if (!client) {
    client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableReadyCheck: false,
    });
    client.on("error", (err: Error) => {
      console.warn("[Redis] connection error:", err.message);
    });
  }

  return client;
}

import { createClient } from "redis";

type AppRedisClient = ReturnType<typeof createClient>;

declare global {
  // eslint-disable-next-line no-var
  var __hitechclawRedisClientPromise: Promise<AppRedisClient | null> | undefined;
}

async function connectRedis(): Promise<AppRedisClient | null> {
  const url = process.env.REDIS_URL?.trim();
  if (!url) {
    return null;
  }

  const client = createClient({ url });
  client.on("error", (error) => {
    console.error("[redis] connection error", error);
  });

  await client.connect();
  return client;
}

export async function getRedisClient(): Promise<AppRedisClient | null> {
  if (!globalThis.__hitechclawRedisClientPromise) {
    globalThis.__hitechclawRedisClientPromise = connectRedis().catch((error) => {
      console.error("[redis] failed to initialize", error);
      globalThis.__hitechclawRedisClientPromise = undefined;
      return null;
    });
  }

  return globalThis.__hitechclawRedisClientPromise;
}

export async function withRedis<T>(callback: (client: AppRedisClient) => Promise<T>): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) {
    return null;
  }

  try {
    return await callback(client);
  } catch (error) {
    console.error("[redis] operation failed", error);
    return null;
  }
}

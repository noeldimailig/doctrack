import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { rateLimitCounters } from "@/lib/db/schema";

/**
 * Postgres-backed fixed-window limiter shared by Better Auth hooks so it works
 * across instances without an external service.
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  const nowIso = now.toISOString();
  const cutoffIso = cutoff.toISOString();

  const [row] = await db
    .insert(rateLimitCounters)
    .values({ key, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: rateLimitCounters.key,
      set: {
        count: sql<number>`case when ${rateLimitCounters.windowStart} < ${cutoffIso}::timestamptz then 1 else ${rateLimitCounters.count} + 1 end`,
        windowStart: sql<Date>`case when ${rateLimitCounters.windowStart} < ${cutoffIso}::timestamptz then ${nowIso}::timestamptz else ${rateLimitCounters.windowStart} end`,
      },
    })
    .returning({ count: rateLimitCounters.count });

  return row.count <= limit;
}
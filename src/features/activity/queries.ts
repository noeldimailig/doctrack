import { and, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { activityLogs, user } from "@/lib/db/schema";
import type { ActivityListQuery } from "./validation";

export async function listActivity(query: ActivityListQuery) {
  const actor = alias(user, "activity_actor");
  const conditions: SQL[] = [];
  if (query.q) {
    conditions.push(
      or(
        ilike(activityLogs.action, `%${query.q}%`),
        ilike(sql`coalesce(${activityLogs.entityLabel}, '')`, `%${query.q}%`),
        ilike(sql`coalesce(${actor.name}, '')`, `%${query.q}%`),
      ) as SQL,
    );
  }
  if (query.entityType) conditions.push(eq(activityLogs.entityType, query.entityType));
  if (query.action) conditions.push(eq(activityLogs.action, query.action));

  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        entityId: activityLogs.entityId,
        entityLabel: activityLogs.entityLabel,
        details: activityLogs.details,
        occurredAt: activityLogs.occurredAt,
        actorName: actor.name,
      })
      .from(activityLogs)
      .leftJoin(actor, eq(activityLogs.actorUserId, actor.id))
      .where(where)
      .orderBy(desc(activityLogs.occurredAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(activityLogs).leftJoin(actor, eq(activityLogs.actorUserId, actor.id)).where(where),
  ]);

  return { rows, total: totalResult[0]?.value ?? 0 };
}

export async function listActivityActions() {
  return db
    .selectDistinct({ action: activityLogs.action })
    .from(activityLogs)
    .orderBy(activityLogs.action);
}

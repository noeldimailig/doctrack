import { and, asc, count, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { activityLogs, transmittalItems, transmittals, user } from "@/lib/db/schema";
import type { transmittalListQuerySchema } from "./validation";
import type { z } from "zod";

type TransmittalListQuery = z.infer<typeof transmittalListQuerySchema>;

export async function listTransmittals(query: TransmittalListQuery) {
  const preparedBy = alias(user, "transmittal_prepared_by");
  const finalizedBy = alias(user, "transmittal_finalized_by");
  const conditions: SQL[] = [];
  if (query.q) {
    conditions.push(
      or(
        ilike(transmittals.transmittalNumber, `%${query.q}%`),
        ilike(transmittals.destinationNameSnapshot, `%${query.q}%`),
        ilike(sql`coalesce(${transmittals.remarks}, '')`, `%${query.q}%`),
      ) as SQL,
    );
  }
  if (query.status) conditions.push(eq(transmittals.status, query.status));

  return db
    .select({
      id: transmittals.id,
      transmittalNumber: transmittals.transmittalNumber,
      status: transmittals.status,
      destinationName: transmittals.destinationNameSnapshot,
      signatoryName: transmittals.signatoryNameSnapshot,
      preparedByName: preparedBy.name,
      finalizedByName: finalizedBy.name,
      preparedAt: transmittals.preparedAt,
      finalizedAt: transmittals.finalizedAt,
      documentCount: sql<number>`count(${transmittalItems.id})::int`,
    })
    .from(transmittals)
    .leftJoin(preparedBy, eq(transmittals.preparedBy, preparedBy.id))
    .leftJoin(finalizedBy, eq(transmittals.finalizedBy, finalizedBy.id))
    .leftJoin(transmittalItems, eq(transmittalItems.transmittalId, transmittals.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .groupBy(transmittals.id, preparedBy.name, finalizedBy.name)
    .orderBy(desc(transmittals.createdAt));
}

export async function getTransmittalDetail(id: string) {
  const preparedBy = alias(user, "detail_prepared_by");
  const finalizedBy = alias(user, "detail_finalized_by");
  const [row] = await db
    .select({
      transmittal: transmittals,
      preparedByName: preparedBy.name,
      finalizedByName: finalizedBy.name,
    })
    .from(transmittals)
    .leftJoin(preparedBy, eq(transmittals.preparedBy, preparedBy.id))
    .leftJoin(finalizedBy, eq(transmittals.finalizedBy, finalizedBy.id))
    .where(eq(transmittals.id, id))
    .limit(1);
  return row ?? null;
}

export async function getTransmittalItems(transmittalId: string) {
  return db
    .select({
      id: transmittalItems.id,
      documentId: transmittalItems.documentId,
      isFinalized: transmittalItems.isFinalized,
      trackingNumber: transmittalItems.trackingNumberSnapshot,
      referenceNumber: transmittalItems.referenceNumberSnapshot,
      title: transmittalItems.titleSnapshot,
      documentType: transmittalItems.documentTypeSnapshot,
      documentDate: transmittalItems.documentDateSnapshot,
      remarks: transmittalItems.remarksSnapshot,
      includedAt: transmittalItems.includedAt,
    })
    .from(transmittalItems)
    .where(eq(transmittalItems.transmittalId, transmittalId))
    .orderBy(asc(transmittalItems.trackingNumberSnapshot));
}

export async function getTransmittalActivity(transmittalId: string) {
  const actor = alias(user, "transmittal_activity_actor");
  return db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      details: activityLogs.details,
      occurredAt: activityLogs.occurredAt,
      actorName: actor.name,
    })
    .from(activityLogs)
    .leftJoin(actor, eq(activityLogs.actorUserId, actor.id))
    .where(and(eq(activityLogs.entityType, "transmittal"), eq(activityLogs.entityId, transmittalId)))
    .orderBy(desc(activityLogs.occurredAt));
}

export async function getTransmittalStatusCounts() {
  return db
    .select({ status: transmittals.status, value: count() })
    .from(transmittals)
    .groupBy(transmittals.status);
}

export async function getRecentFinalizedTransmittals(limit = 5) {
  return db
    .select({
      id: transmittals.id,
      transmittalNumber: transmittals.transmittalNumber,
      destinationName: transmittals.destinationNameSnapshot,
      finalizedAt: transmittals.finalizedAt,
    })
    .from(transmittals)
    .where(eq(transmittals.status, "FINALIZED"))
    .orderBy(desc(transmittals.finalizedAt))
    .limit(limit);
}

import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  activityLogs,
  documentTypes,
  documents,
  focalPersons,
  offices,
  transmittalItems,
  transmittals,
  user,
} from "@/lib/db/schema";
import type { ReportQuery } from "./validation";

function documentConditions(query: ReportQuery): SQL[] {
  const conditions: SQL[] = [];
  if (query.q) {
    conditions.push(
      or(
        ilike(documents.trackingNumber, `%${query.q}%`),
        ilike(documents.title, `%${query.q}%`),
        ilike(sql`coalesce(${documents.referenceNumber}, '')`, `%${query.q}%`),
      ) as SQL,
    );
  }
  if (query.officeId) conditions.push(eq(documents.destinationOfficeId, query.officeId));
  if (query.focalPersonId) conditions.push(eq(documents.intendedFocalPersonId, query.focalPersonId));
  if (query.status) {
    conditions.push(eq(documents.currentStatus, query.status as (typeof documents.currentStatus.enumValues)[number]));
  }
  if (query.documentTypeId) conditions.push(eq(documents.documentTypeId, query.documentTypeId));
  if (query.dateFrom) conditions.push(gte(documents.dateReceived, query.dateFrom));
  if (query.dateTo) conditions.push(lte(documents.dateReceived, query.dateTo));

  if (query.type === "outgoing") {
    conditions.push(inArray(documents.currentStatus, ["READY_FOR_TRANSMITTAL", "TRANSMITTED"]));
  } else if (query.type === "returned") {
    conditions.push(eq(documents.currentStatus, "RETURNED_FOR_CORRECTION"));
  } else if (query.type === "awaiting-decision") {
    conditions.push(eq(documents.currentStatus, "FORWARDED_TO_FOCAL_PERSON"));
  }
  return conditions;
}

export async function getDocumentReportRows(query: ReportQuery) {
  const destinationOffice = alias(offices, "report_destination");
  const focal = alias(focalPersons, "report_focal");
  const conditions = documentConditions(query);

  return db
    .select({
      trackingNumber: documents.trackingNumber,
      referenceNumber: documents.referenceNumber,
      title: documents.title,
      dateReceived: documents.dateReceived,
      status: documents.currentStatus,
      documentType: documentTypes.name,
      destination: destinationOffice.name,
      focalPerson: focal.fullName,
      outgoingDate: documents.outgoingDate,
      transmittalNumber: transmittals.transmittalNumber,
    })
    .from(documents)
    .leftJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
    .leftJoin(destinationOffice, eq(documents.destinationOfficeId, destinationOffice.id))
    .leftJoin(focal, eq(documents.intendedFocalPersonId, focal.id))
    .leftJoin(
      transmittalItems,
      and(eq(transmittalItems.documentId, documents.id), eq(transmittalItems.isFinalized, true)),
    )
    .leftJoin(transmittals, eq(transmittals.id, transmittalItems.transmittalId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(documents.dateReceived), asc(documents.trackingNumber));
}

export async function getTransmittalReportRows(query: ReportQuery) {
  const preparedBy = alias(user, "report_prepared_by");
  const finalizedBy = alias(user, "report_finalized_by");
  const conditions: SQL[] = [];
  if (query.q) {
    conditions.push(
      or(
        ilike(transmittals.transmittalNumber, `%${query.q}%`),
        ilike(transmittals.destinationNameSnapshot, `%${query.q}%`),
      ) as SQL,
    );
  }
  if (query.officeId) conditions.push(eq(transmittals.destinationOfficeId, query.officeId));
  if (query.status) {
    conditions.push(eq(transmittals.status, query.status as (typeof transmittals.status.enumValues)[number]));
  }
  if (query.dateFrom) conditions.push(gte(transmittals.preparedAt, new Date(`${query.dateFrom}T00:00:00Z`)));
  if (query.dateTo) conditions.push(lte(transmittals.preparedAt, new Date(`${query.dateTo}T23:59:59.999Z`)));

  return db
    .select({
      transmittalNumber: transmittals.transmittalNumber,
      status: transmittals.status,
      destination: transmittals.destinationNameSnapshot,
      signatory: transmittals.signatoryNameSnapshot,
      preparedBy: preparedBy.name,
      preparedAt: transmittals.preparedAt,
      finalizedAt: transmittals.finalizedAt,
    })
    .from(transmittals)
    .leftJoin(preparedBy, eq(transmittals.preparedBy, preparedBy.id))
    .leftJoin(finalizedBy, eq(transmittals.finalizedBy, finalizedBy.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(transmittals.preparedAt));
}

export async function getActivityReportRows(query: ReportQuery) {
  const actor = alias(user, "report_activity_actor");
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
  if (query.dateFrom) conditions.push(gte(activityLogs.occurredAt, new Date(`${query.dateFrom}T00:00:00Z`)));
  if (query.dateTo) conditions.push(lte(activityLogs.occurredAt, new Date(`${query.dateTo}T23:59:59.999Z`)));

  return db
    .select({
      action: activityLogs.action,
      entityType: activityLogs.entityType,
      entityLabel: activityLogs.entityLabel,
      details: activityLogs.details,
      actorName: actor.name,
      occurredAt: activityLogs.occurredAt,
    })
    .from(activityLogs)
    .leftJoin(actor, eq(activityLogs.actorUserId, actor.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(activityLogs.occurredAt));
}

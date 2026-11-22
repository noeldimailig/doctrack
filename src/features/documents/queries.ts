import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  activityLogs,
  documentAssignments,
  documentCorrectiveActions,
  documentForwardings,
  documentReturns,
  documentReviews,
  documentStatusHistory,
  documents,
  documentTypes,
  focalPersons,
  offices,
  transmittalItems,
  transmittals,
  user,
} from "@/lib/db/schema";
import type { DocumentListQuery } from "./validation";

function buildFilters(query: DocumentListQuery): SQL | undefined {
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
  if (query.status) conditions.push(eq(documents.currentStatus, query.status as typeof documents.currentStatus.enumValues[number]));
  if (query.officeId) conditions.push(eq(documents.destinationOfficeId, query.officeId));
  if (query.focalPersonId) conditions.push(eq(documents.intendedFocalPersonId, query.focalPersonId));
  if (query.dateFrom) conditions.push(gte(documents.dateReceived, query.dateFrom));
  if (query.dateTo) conditions.push(lte(documents.dateReceived, query.dateTo));
  return conditions.length ? and(...conditions) : undefined;
}

export async function listDocuments(query: DocumentListQuery) {
  const senderOffice = alias(offices, "sender_office");
  const destinationOffice = alias(offices, "destination_office");
  const focal = alias(focalPersons, "intended_focal");
  const assignedUser = alias(user, "assigned_user");

  const filters = buildFilters(query);
  const sortColumn = {
    date_received: documents.dateReceived,
    tracking_number: documents.trackingNumber,
    created_at: documents.createdAt,
    title: documents.title,
    status: documents.currentStatus,
  }[query.sort];
  const order = query.direction === "asc" ? asc(sortColumn) : desc(sortColumn);

  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: documents.id,
        trackingNumber: documents.trackingNumber,
        referenceNumber: documents.referenceNumber,
        title: documents.title,
        dateReceived: documents.dateReceived,
        documentDate: documents.documentDate,
        currentStatus: documents.currentStatus,
        senderOfficeName: senderOffice.name,
        destinationOfficeName: destinationOffice.name,
        focalPersonName: focal.fullName,
        assignedUserName: assignedUser.name,
        encodedAt: documents.encodedAt,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .leftJoin(senderOffice, eq(documents.senderOfficeId, senderOffice.id))
      .leftJoin(destinationOffice, eq(documents.destinationOfficeId, destinationOffice.id))
      .leftJoin(focal, eq(documents.intendedFocalPersonId, focal.id))
      .leftJoin(assignedUser, eq(documents.assignedUserId, assignedUser.id))
      .where(filters)
      .orderBy(order, desc(documents.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ value: count() }).from(documents).where(filters),
  ]);

  return { rows, total: totalResult[0]?.value ?? 0 };
}

export async function getDocumentDetail(id: string) {
  const senderOffice = alias(offices, "sender_office");
  const destinationOffice = alias(offices, "destination_office");
  const focal = alias(focalPersons, "intended_focal");
  const assignedUser = alias(user, "assigned_user");
  const encodedByUser = alias(user, "encoded_by_user");
  const readyByUser = alias(user, "ready_by_user");

  const [row] = await db
    .select({
      document: documents,
      documentTypeName: documentTypes.name,
      senderOfficeName: senderOffice.name,
      destinationOfficeName: destinationOffice.name,
      focalPersonName: focal.fullName,
      focalPersonPosition: focal.position,
      assignedUserName: assignedUser.name,
      encodedByUserName: encodedByUser.name,
      readyByUserName: readyByUser.name,
    })
    .from(documents)
    .leftJoin(documentTypes, eq(documents.documentTypeId, documentTypes.id))
    .leftJoin(senderOffice, eq(documents.senderOfficeId, senderOffice.id))
    .leftJoin(destinationOffice, eq(documents.destinationOfficeId, destinationOffice.id))
    .leftJoin(focal, eq(documents.intendedFocalPersonId, focal.id))
    .leftJoin(assignedUser, eq(documents.assignedUserId, assignedUser.id))
    .leftJoin(encodedByUser, eq(documents.encodedBy, encodedByUser.id))
    .leftJoin(readyByUser, eq(documents.readyBy, readyByUser.id))
    .where(eq(documents.id, id))
    .limit(1);
  return row ?? null;
}

export async function getDocumentStatusHistory(documentId: string) {
  const changedByUser = alias(user, "history_changed_by");
  return db
    .select({
      id: documentStatusHistory.id,
      fromStatus: documentStatusHistory.fromStatus,
      toStatus: documentStatusHistory.toStatus,
      action: documentStatusHistory.action,
      reason: documentStatusHistory.reason,
      metadata: documentStatusHistory.metadata,
      createdAt: documentStatusHistory.createdAt,
      changedByName: changedByUser.name,
    })
    .from(documentStatusHistory)
    .leftJoin(changedByUser, eq(documentStatusHistory.changedBy, changedByUser.id))
    .where(eq(documentStatusHistory.documentId, documentId))
    .orderBy(asc(documentStatusHistory.createdAt));
}

export async function getDocumentAssignments(documentId: string) {
  const focal = alias(focalPersons, "assignment_focal");
  const assignedByUser = alias(user, "assignment_user");
  return db
    .select({
      id: documentAssignments.id,
      cycleNumber: documentAssignments.cycleNumber,
      focalPersonName: focal.fullName,
      assignedByName: assignedByUser.name,
      assignedAt: documentAssignments.assignedAt,
      notes: documentAssignments.notes,
      isCurrent: documentAssignments.isCurrent,
    })
    .from(documentAssignments)
    .innerJoin(focal, eq(documentAssignments.focalPersonId, focal.id))
    .innerJoin(assignedByUser, eq(documentAssignments.assignedBy, assignedByUser.id))
    .where(eq(documentAssignments.documentId, documentId))
    .orderBy(asc(documentAssignments.cycleNumber));
}

export async function getDocumentForwardings(documentId: string) {
  const focal = alias(focalPersons, "forward_focal");
  const forwardedByUser = alias(user, "forward_user");
  return db
    .select({
      id: documentForwardings.id,
      cycleNumber: documentForwardings.cycleNumber,
      focalPersonName: focal.fullName,
      forwardedByName: forwardedByUser.name,
      forwardedAt: documentForwardings.forwardedAt,
      remarks: documentForwardings.remarks,
    })
    .from(documentForwardings)
    .innerJoin(focal, eq(documentForwardings.focalPersonId, focal.id))
    .innerJoin(forwardedByUser, eq(documentForwardings.forwardedBy, forwardedByUser.id))
    .where(eq(documentForwardings.documentId, documentId))
    .orderBy(asc(documentForwardings.cycleNumber));
}

export async function getDocumentReviews(documentId: string) {
  const focal = alias(focalPersons, "review_focal");
  const recordedByUser = alias(user, "review_recorder");
  return db
    .select({
      id: documentReviews.id,
      focalPersonName: focal.fullName,
      decision: documentReviews.decision,
      decisionDate: documentReviews.decisionDate,
      remarks: documentReviews.remarks,
      recordedByName: recordedByUser.name,
      recordedAt: documentReviews.recordedAt,
      returnedToReceivingAt: documentReviews.returnedToReceivingAt,
    })
    .from(documentReviews)
    .innerJoin(focal, eq(documentReviews.focalPersonId, focal.id))
    .innerJoin(recordedByUser, eq(documentReviews.recordedBy, recordedByUser.id))
    .where(eq(documentReviews.documentId, documentId))
    .orderBy(desc(documentReviews.recordedAt));
}

export async function getDocumentReturns(documentId: string) {
  return db
    .select({
      id: documentReturns.id,
      returnRemarks: documentReturns.returnRemarks,
      receivedAt: documentReturns.receivedAt,
      createdAt: documentReturns.createdAt,
    })
    .from(documentReturns)
    .where(eq(documentReturns.documentId, documentId))
    .orderBy(asc(documentReturns.createdAt));
}

export async function getCorrectiveActions(documentId: string) {
  const recordedByUser = alias(user, "correction_user");
  return db
    .select({
      id: documentCorrectiveActions.id,
      actionTaken: documentCorrectiveActions.actionTaken,
      correctedAt: documentCorrectiveActions.correctedAt,
      recordedByName: recordedByUser.name,
      createdAt: documentCorrectiveActions.createdAt,
    })
    .from(documentCorrectiveActions)
    .innerJoin(recordedByUser, eq(documentCorrectiveActions.recordedBy, recordedByUser.id))
    .where(eq(documentCorrectiveActions.documentId, documentId))
    .orderBy(asc(documentCorrectiveActions.createdAt));
}

export async function getDocumentTransmittal(documentId: string) {
  const [row] = await db
    .select({
      transmittalId: transmittals.id,
      transmittalNumber: transmittals.transmittalNumber,
      status: transmittals.status,
      finalizedAt: transmittals.finalizedAt,
      destinationSnapshot: transmittals.destinationNameSnapshot,
    })
    .from(transmittalItems)
    .innerJoin(transmittals, eq(transmittalItems.transmittalId, transmittals.id))
    .where(and(eq(transmittalItems.documentId, documentId), eq(transmittalItems.isFinalized, true)))
    .limit(1);
  return row ?? null;
}

export async function getDocumentActivity(documentId: string) {
  const actor = alias(user, "activity_actor");
  return db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      entityType: activityLogs.entityType,
      details: activityLogs.details,
      occurredAt: activityLogs.occurredAt,
      actorName: actor.name,
    })
    .from(activityLogs)
    .leftJoin(actor, eq(activityLogs.actorUserId, actor.id))
    .where(and(eq(activityLogs.entityType, "document"), eq(activityLogs.entityId, documentId)))
    .orderBy(desc(activityLogs.occurredAt))
    .limit(100);
}

const QUEUE_STATUSES = [
  "RECEIVED",
  "ENCODED",
  "FORWARDED_TO_FOCAL_PERSON",
  "RETURNED_FOR_CORRECTION",
  "APPROVED",
  "READY_FOR_TRANSMITTAL",
] as const;

type QueueView = "all" | "encoding" | "awaiting-decision" | "returned" | "approved" | "ready";

const QUEUE_FILTERS: Record<QueueView, readonly (typeof QUEUE_STATUSES)[number][]> = {
  all: QUEUE_STATUSES,
  encoding: ["RECEIVED"],
  "awaiting-decision": ["FORWARDED_TO_FOCAL_PERSON"],
  returned: ["RETURNED_FOR_CORRECTION"],
  approved: ["APPROVED"],
  ready: ["READY_FOR_TRANSMITTAL"],
};

/** Work queues for application users. Focal persons have no inbox or login. */
export async function listProcessingQueue(view: QueueView = "all", userId?: string) {
  const destinationOffice = alias(offices, "queue_destination");
  const focal = alias(focalPersons, "queue_focal");
  const assignedUser = alias(user, "queue_assigned");

  return db
    .select({
      id: documents.id,
      trackingNumber: documents.trackingNumber,
      title: documents.title,
      dateReceived: documents.dateReceived,
      currentStatus: documents.currentStatus,
      destinationOfficeName: destinationOffice.name,
      focalPersonName: focal.fullName,
      assignedUserName: assignedUser.name,
      encodedAt: documents.encodedAt,
      readyForTransmittalAt: documents.readyForTransmittalAt,
    })
    .from(documents)
    .leftJoin(destinationOffice, eq(documents.destinationOfficeId, destinationOffice.id))
    .leftJoin(focal, eq(documents.intendedFocalPersonId, focal.id))
    .leftJoin(assignedUser, eq(documents.assignedUserId, assignedUser.id))
    .where(
      and(
        inArray(documents.currentStatus, [...QUEUE_FILTERS[view]]),
        userId ? eq(documents.assignedUserId, userId) : undefined,
      ),
    )
    .orderBy(asc(documents.dateReceived), asc(documents.trackingNumber));
}

export { QUEUE_FILTERS };
export type { QueueView };

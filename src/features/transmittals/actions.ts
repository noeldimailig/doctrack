"use server";

import { and, eq, inArray, ne, notExists } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ConflictError, InvalidTransitionError, NotFoundError } from "@/lib/error/app-error";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  documentTypes,
  documents,
  focalPersons,
  offices,
  transmittalItems,
  transmittals,
} from "@/lib/db/schema";
import { runAction } from "@/lib/error/action";
import { failure, failureFromZod, success, type ActionResult } from "@/lib/error/action-result";
import { applyStatusChange, lockDocument, recordActivity } from "@/features/documents/service";
import { nextTransmittalNumber } from "@/lib/utils/tracking-number";
import { createTransmittalSchema, prepareOutgoingSchema } from "./validation";

type DbExecutor = Pick<typeof db, "select" | "insert" | "update">;

function nullable(value: string | null | undefined): string | null {
  return value ? value : null;
}

/** Rejects documents already placed in a draft or finalized transmittal. Cancelled drafts release their documents. */
async function checkNoActiveItems(
  executor: DbExecutor,
  documentIds: string[],
  excludeTransmittalId?: string,
): Promise<void> {
  const rows = await executor
    .select({ documentId: transmittalItems.documentId, transmittalId: transmittalItems.transmittalId })
    .from(transmittalItems)
    .innerJoin(transmittals, eq(transmittalItems.transmittalId, transmittals.id))
    .where(and(inArray(transmittalItems.documentId, documentIds), ne(transmittals.status, "CANCELLED")));

  const conflicts = rows.filter((row) => row.transmittalId !== excludeTransmittalId);
  if (conflicts.length > 0) {
    throw new ConflictError("One or more documents are already included in an active transmittal.");
  }
}

export async function prepareOutgoing(documentId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("transmittal:create");
    const parsed = prepareOutgoingSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    await db.transaction(async (tx) => {
      const document = await lockDocument(tx, documentId);
      await applyStatusChange({
        executor: tx,
        documentId,
        action: "PREPARE_OUTGOING",
        currentStatus: document.currentStatus,
        actorUserId: session.user.id,
        metadata: {
          outgoingDate: parsed.data.outgoingDate || null,
          outgoingReferenceNumber: nullable(parsed.data.outgoingReferenceNumber),
        },
        extraValues: {
          outgoingDate: nullable(parsed.data.outgoingDate),
          outgoingReferenceNumber: nullable(parsed.data.outgoingReferenceNumber),
          outgoingRemarks: nullable(parsed.data.remarks),
          readyForTransmittalAt: new Date(),
          readyBy: session.user.id,
        },
      });
      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: "DOCUMENT_PREPARED_FOR_TRANSMITTAL",
        entityType: "document",
        entityId: documentId,
        entityLabel: document.trackingNumber,
      });
    });
    return success({ id: documentId });
  });
}

/** Eligibility query shared by the outgoing list and the transmittal builder. */
export async function findEligibleDocuments(destinationOfficeId?: string) {
  const destinationOffice = alias(offices, "eligible_destination");
  const focal = alias(focalPersons, "eligible_focal");

  return db
    .select({
      id: documents.id,
      trackingNumber: documents.trackingNumber,
      referenceNumber: documents.referenceNumber,
      title: documents.title,
      dateReceived: documents.dateReceived,
      destinationOfficeId: documents.destinationOfficeId,
      destinationOfficeName: destinationOffice.name,
      focalPersonId: documents.intendedFocalPersonId,
      focalPersonName: focal.fullName,
      outgoingDate: documents.outgoingDate,
      outgoingReferenceNumber: documents.outgoingReferenceNumber,
    })
    .from(documents)
    .innerJoin(destinationOffice, eq(documents.destinationOfficeId, destinationOffice.id))
    .leftJoin(focal, eq(documents.intendedFocalPersonId, focal.id))
    .where(
      and(
        eq(documents.currentStatus, "READY_FOR_TRANSMITTAL"),
        destinationOfficeId ? eq(documents.destinationOfficeId, destinationOfficeId) : undefined,
        notExists(
          db
            .select({ id: transmittalItems.id })
            .from(transmittalItems)
            .innerJoin(transmittals, eq(transmittalItems.transmittalId, transmittals.id))
            .where(
              and(
                eq(transmittalItems.documentId, documents.id),
                ne(transmittals.status, "CANCELLED"),
              ),
            ),
        ),
      ),
    )
    .orderBy(documents.dateReceived, documents.trackingNumber);
}

export async function createTransmittal(input: unknown): Promise<ActionResult<{ id: string; transmittalNumber: string }>> {
  return runAction(async () => {
    const session = await requirePermission("transmittal:create");
    const parsed = createTransmittalSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const documentIds = [...new Set(parsed.data.documentIds)];
    const [office] = await db
      .select({ id: offices.id, name: offices.name, isActive: offices.isActive })
      .from(offices)
      .where(eq(offices.id, parsed.data.destinationOfficeId))
      .limit(1);
    if (!office || !office.isActive) return failure("VALIDATION_ERROR", "Select an active destination office.");

    let signatoryName: string | null = null;
    if (parsed.data.destinationSignatoryFocalPersonId) {
      const [signatory] = await db
        .select({
          id: focalPersons.id,
          fullName: focalPersons.fullName,
          officeId: focalPersons.officeId,
          isActive: focalPersons.isActive,
        })
        .from(focalPersons)
        .where(eq(focalPersons.id, parsed.data.destinationSignatoryFocalPersonId))
        .limit(1);
      if (!signatory || !signatory.isActive) {
        return failure("VALIDATION_ERROR", "Select an active signatory.");
      }
      if (signatory.officeId !== parsed.data.destinationOfficeId) {
        return failure("VALIDATION_ERROR", "The signatory must belong to the destination office.");
      }
      signatoryName = signatory.fullName;
    }

    const transmittalNumber = await nextTransmittalNumber(new Date().getUTCFullYear());

    const created = await db.transaction(async (tx) => {
      const documentRows = await tx
        .select({ document: documents })
        .from(documents)
        .where(inArray(documents.id, documentIds))
        .for("update");
      if (documentRows.length !== documentIds.length) {
        throw new NotFoundError("One or more selected documents do not exist.");
      }
      const rows = documentRows.map((row) => row.document);
      if (rows.some((document) => document.currentStatus !== "READY_FOR_TRANSMITTAL")) {
        throw new ConflictError("All selected documents must be ready for transmittal.");
      }
      if (rows.some((document) => document.destinationOfficeId !== office.id)) {
        throw new ConflictError("A transmittal can contain documents for only one destination office.");
      }
      await checkNoActiveItems(tx, documentIds);

      const typeIds = [...new Set(rows.map((document) => document.documentTypeId).filter((id): id is string => Boolean(id)))];
      const typeRows = typeIds.length
        ? await tx.select({ id: documentTypes.id, name: documentTypes.name }).from(documentTypes).where(inArray(documentTypes.id, typeIds))
        : [];
      const typeNames = new Map(typeRows.map((type) => [type.id, type.name]));

      const [record] = await tx
        .insert(transmittals)
        .values({
          transmittalNumber,
          status: "DRAFT",
          destinationOfficeId: office.id,
          destinationSignatoryFocalPersonId: parsed.data.destinationSignatoryFocalPersonId ?? null,
          destinationNameSnapshot: office.name,
          signatoryNameSnapshot: signatoryName,
          preparedBy: session.user.id,
          remarks: nullable(parsed.data.remarks),
        })
        .returning({ id: transmittals.id, transmittalNumber: transmittals.transmittalNumber });

      await tx.insert(transmittalItems).values(
        rows.map((document) => ({
          transmittalId: record.id,
          documentId: document.id,
          trackingNumberSnapshot: document.trackingNumber,
          referenceNumberSnapshot: document.referenceNumber,
          titleSnapshot: document.title,
          documentTypeSnapshot: document.documentTypeId ? typeNames.get(document.documentTypeId) ?? null : null,
          documentDateSnapshot: document.documentDate,
          remarksSnapshot: document.remarks,
          includedBy: session.user.id,
        })),
      );

      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: "TRANSMITTAL_CREATED",
        entityType: "transmittal",
        entityId: record.id,
        entityLabel: record.transmittalNumber,
        details: { destinationOfficeId: office.id, documentCount: documentIds.length },
      });
      return record;
    });

    return success(created);
  });
}

export async function finalizeTransmittal(transmittalId: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("transmittal:finalize");

    await db.transaction(async (tx) => {
      const [record] = await tx
        .select({
          id: transmittals.id,
          transmittalNumber: transmittals.transmittalNumber,
          status: transmittals.status,
          destinationOfficeId: transmittals.destinationOfficeId,
        })
        .from(transmittals)
        .where(eq(transmittals.id, transmittalId))
        .for("update")
        .limit(1);
      if (!record) throw new NotFoundError("Transmittal not found.");
      if (record.status !== "DRAFT") throw new InvalidTransitionError("Only draft transmittals can be finalized.");

      const items = await tx
        .select({ documentId: transmittalItems.documentId })
        .from(transmittalItems)
        .where(eq(transmittalItems.transmittalId, transmittalId));
      const documentIds = items.map((item) => item.documentId);
      if (documentIds.length === 0) throw new InvalidTransitionError("A transmittal must contain at least one document.");

      const documentRows = await tx
        .select({ document: documents })
        .from(documents)
        .where(inArray(documents.id, documentIds))
        .for("update");
      if (documentRows.length !== documentIds.length) {
        throw new ConflictError("A selected document is no longer available.");
      }
      const rows = documentRows.map((row) => row.document);
      if (rows.some((document) => document.currentStatus !== "READY_FOR_TRANSMITTAL")) {
        throw new ConflictError("A selected document is no longer eligible for transmittal.");
      }
      if (rows.some((document) => document.destinationOfficeId !== record.destinationOfficeId)) {
        throw new ConflictError("A selected document no longer belongs to the transmittal destination.");
      }
      await checkNoActiveItems(tx, documentIds, transmittalId);

      const typeIds = [...new Set(rows.map((document) => document.documentTypeId).filter((id): id is string => Boolean(id)))];
      const typeRows = typeIds.length
        ? await tx.select({ id: documentTypes.id, name: documentTypes.name }).from(documentTypes).where(inArray(documentTypes.id, typeIds))
        : [];
      const typeNames = new Map(typeRows.map((type) => [type.id, type.name]));

      await tx
        .update(transmittals)
        .set({ status: "FINALIZED", finalizedAt: new Date(), finalizedBy: session.user.id, updatedAt: new Date() })
        .where(eq(transmittals.id, transmittalId));

      for (const document of rows) {
        await tx
          .update(transmittalItems)
          .set({
            isFinalized: true,
            trackingNumberSnapshot: document.trackingNumber,
            referenceNumberSnapshot: document.referenceNumber,
            titleSnapshot: document.title,
            documentTypeSnapshot: document.documentTypeId ? typeNames.get(document.documentTypeId) ?? null : null,
            documentDateSnapshot: document.documentDate,
            remarksSnapshot: document.remarks,
          })
          .where(and(eq(transmittalItems.transmittalId, transmittalId), eq(transmittalItems.documentId, document.id)));

        await applyStatusChange({
          executor: tx,
          documentId: document.id,
          action: "FINALIZE_TRANSMITTAL",
          currentStatus: document.currentStatus,
          actorUserId: session.user.id,
          reason: `Included in ${record.transmittalNumber}`,
          metadata: { transmittalId, transmittalNumber: record.transmittalNumber },
        });
        await recordActivity({
          executor: tx,
          actorUserId: session.user.id,
          action: "DOCUMENT_TRANSMITTED",
          entityType: "document",
          entityId: document.id,
          entityLabel: document.trackingNumber,
          details: { transmittalId, transmittalNumber: record.transmittalNumber },
        });
      }

      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: "TRANSMITTAL_FINALIZED",
        entityType: "transmittal",
        entityId: transmittalId,
        entityLabel: record.transmittalNumber,
        details: { documentCount: documentIds.length },
      });
    });

    return success({ id: transmittalId });
  });
}

export async function cancelTransmittal(transmittalId: string, reason: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("transmittal:finalize");
    if (!reason?.trim()) return failure("VALIDATION_ERROR", "A cancellation reason is required.");

    const cancelled = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(transmittals)
        .set({ status: "CANCELLED", cancellationReason: reason.trim(), updatedAt: new Date() })
        .where(and(eq(transmittals.id, transmittalId), eq(transmittals.status, "DRAFT")))
        .returning({ id: transmittals.id, transmittalNumber: transmittals.transmittalNumber });
      if (!record) return null;

      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: "TRANSMITTAL_CANCELLED",
        entityType: "transmittal",
        entityId: transmittalId,
        entityLabel: record.transmittalNumber,
        details: { reason: reason.trim() },
      });
      return record;
    });
    if (!cancelled) return failure("CONFLICT", "Only draft transmittals can be cancelled.");

    return success({ id: transmittalId });
  });
}

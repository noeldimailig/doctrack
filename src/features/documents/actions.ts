"use server";

import { eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documents, documentTypes, focalPersons, offices, user } from "@/lib/db/schema";
import { runAction } from "@/lib/error/action";
import { failure, failureFromZod, success, type ActionResult } from "@/lib/error/action-result";
import { ForbiddenError } from "@/lib/error/app-error";
import { nextTrackingNumber } from "@/lib/utils/tracking-number";
import { applyStatusChange, lockDocument, recordActivity, recordStatusChange } from "./service";
import { cancelDocumentSchema, createDocumentSchema, updateDocumentSchema } from "./validation";

function nullable(value: string | null | undefined): string | null {
  return value ? value : null;
}

async function validateReferences(input: {
  documentTypeId?: string | null;
  senderOfficeId?: string | null;
  assignedUserId?: string;
  destinationOfficeId: string;
  intendedFocalPersonId: string;
}): Promise<string | null> {
  if (input.documentTypeId) {
    const [row] = await db.select({ id: documentTypes.id }).from(documentTypes).where(eq(documentTypes.id, input.documentTypeId)).limit(1);
    if (!row) return "The selected document type does not exist.";
  }
  if (input.senderOfficeId) {
    const [row] = await db.select({ id: offices.id }).from(offices).where(eq(offices.id, input.senderOfficeId)).limit(1);
    if (!row) return "The selected sender office does not exist.";
  }
  if (input.assignedUserId) {
    const [row] = await db.select({ id: user.id }).from(user).where(eq(user.id, input.assignedUserId)).limit(1);
    if (!row) return "The selected receiving personnel does not exist.";
  }
  const [destination] = await db.select({ id: offices.id, isActive: offices.isActive }).from(offices).where(eq(offices.id, input.destinationOfficeId)).limit(1);
  if (!destination || !destination.isActive) return "Select an active destination office.";
  const [focal] = await db
    .select({ id: focalPersons.id, isActive: focalPersons.isActive, officeId: focalPersons.officeId })
    .from(focalPersons)
    .where(eq(focalPersons.id, input.intendedFocalPersonId))
    .limit(1);
  if (!focal || !focal.isActive) return "Select an active focal person.";
  if (focal.officeId !== input.destinationOfficeId) {
    return "The selected focal person does not belong to the destination office.";
  }
  return null;
}

export async function createDocument(input: unknown): Promise<ActionResult<{ id: string; trackingNumber: string }>> {
  return runAction(async () => {
    const session = await requirePermission("document:create");
    const parsed = createDocumentSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const referenceError = await validateReferences(parsed.data);
    if (referenceError) return failure("VALIDATION_ERROR", referenceError);

    const trackingNumber = await nextTrackingNumber(new Date().getUTCFullYear());
    const createdAt = new Date();

    const result = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(documents)
        .values({
          trackingNumber,
          referenceNumber: nullable(parsed.data.referenceNumber),
          title: parsed.data.title,
          documentTypeId: nullable(parsed.data.documentTypeId),
          documentDate: nullable(parsed.data.documentDate),
          dateReceived: parsed.data.dateReceived,
          senderOfficeId: nullable(parsed.data.senderOfficeId),
          senderName: nullable(parsed.data.senderName),
          senderReference: nullable(parsed.data.senderReference),
          assignedUserId: parsed.data.assignedUserId,
          destinationOfficeId: parsed.data.destinationOfficeId,
          intendedFocalPersonId: parsed.data.intendedFocalPersonId,
          currentStatus: "RECEIVED",
          remarks: nullable(parsed.data.remarks),
          createdBy: session.user.id,
          createdAt,
          updatedAt: createdAt,
        })
        .returning({ id: documents.id, trackingNumber: documents.trackingNumber });

      await recordStatusChange({
        executor: tx,
        documentId: created.id,
        fromStatus: null,
        toStatus: "RECEIVED",
        action: "REGISTER",
        changedBy: session.user.id,
        metadata: { trackingNumber },
      });
      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: "DOCUMENT_REGISTERED",
        entityType: "document",
        entityId: created.id,
        entityLabel: trackingNumber,
        details: { title: parsed.data.title, dateReceived: parsed.data.dateReceived },
      });
      return created;
    });

    return success(result);
  });
}

export async function encodeDocument(documentId: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("document:update");
    await db.transaction(async (tx) => {
      const document = await lockDocument(tx, documentId);
      await applyStatusChange({
        executor: tx,
        documentId,
        action: "ENCODE",
        currentStatus: document.currentStatus,
        actorUserId: session.user.id,
        extraValues: { encodedAt: new Date(), encodedBy: session.user.id },
      });
      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: "DOCUMENT_ENCODED",
        entityType: "document",
        entityId: documentId,
        entityLabel: document.trackingNumber,
      });
    });
    return success({ id: documentId });
  });
}

export async function updateDocument(documentId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("document:update");
    const parsed = updateDocumentSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const referenceError = await validateReferences({ ...parsed.data, assignedUserId: undefined });
    if (referenceError) return failure("VALIDATION_ERROR", referenceError);

    await db.transaction(async (tx) => {
      const document = await lockDocument(tx, documentId);
      if (!["RECEIVED", "ENCODED", "RETURNED_FOR_CORRECTION"].includes(document.currentStatus)) {
        throw new ForbiddenError("Document information can only be edited before approval or while returned for correction.");
      }
      await tx
        .update(documents)
        .set({
          referenceNumber: nullable(parsed.data.referenceNumber),
          title: parsed.data.title,
          documentTypeId: nullable(parsed.data.documentTypeId),
          documentDate: nullable(parsed.data.documentDate),
          dateReceived: parsed.data.dateReceived,
          senderOfficeId: nullable(parsed.data.senderOfficeId),
          senderName: nullable(parsed.data.senderName),
          senderReference: nullable(parsed.data.senderReference),
          destinationOfficeId: parsed.data.destinationOfficeId,
          intendedFocalPersonId: parsed.data.intendedFocalPersonId,
          remarks: nullable(parsed.data.remarks),
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: "DOCUMENT_UPDATED",
        entityType: "document",
        entityId: documentId,
        entityLabel: document.trackingNumber,
        details: { status: document.currentStatus },
      });
    });
    return success({ id: documentId });
  });
}

export async function cancelDocument(documentId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("document:cancel");
    const parsed = cancelDocumentSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    await db.transaction(async (tx) => {
      const document = await lockDocument(tx, documentId);
      await applyStatusChange({
        executor: tx,
        documentId,
        action: "CANCEL",
        currentStatus: document.currentStatus,
        actorUserId: session.user.id,
        reason: parsed.data.reason,
        extraValues: { cancelledAt: new Date(), cancellationReason: parsed.data.reason },
      });
      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: "DOCUMENT_CANCELLED",
        entityType: "document",
        entityId: documentId,
        entityLabel: document.trackingNumber,
        details: { reason: parsed.data.reason },
      });
    });
    return success({ id: documentId });
  });
}

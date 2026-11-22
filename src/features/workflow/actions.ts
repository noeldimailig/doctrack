"use server";

import { desc, eq } from "drizzle-orm";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  documentAssignments,
  documentCorrectiveActions,
  documentForwardings,
  documentReturns,
  documentReviews,
  focalPersons,
  user,
} from "@/lib/db/schema";
import { runAction } from "@/lib/error/action";
import { failure, failureFromZod, success, type ActionResult } from "@/lib/error/action-result";
import { ForbiddenError, InvalidTransitionError } from "@/lib/error/app-error";
import { applyStatusChange, lockDocument, recordActivity } from "@/features/documents/service";
import { correctiveActionSchema, forwardDocumentSchema, parseDateTime, recordDecisionSchema } from "./validation";

async function nextCycleNumber(executor: Pick<typeof db, "select">, documentId: string): Promise<number> {
  const [latest] = await executor
    .select({ cycleNumber: documentForwardings.cycleNumber })
    .from(documentForwardings)
    .where(eq(documentForwardings.documentId, documentId))
    .orderBy(desc(documentForwardings.cycleNumber))
    .limit(1);
  return (latest?.cycleNumber ?? 0) + 1;
}

export async function forwardDocument(documentId: string, input: unknown): Promise<ActionResult<{ id: string; cycleNumber: number }>> {
  return runAction(async () => {
    const session = await requirePermission("document:forward");
    const parsed = forwardDocumentSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const forwardedAt = parseDateTime(parsed.data.forwardedAt);
    if (!forwardedAt) return failure("VALIDATION_ERROR", "Enter a valid forwarding date and time.");

    const result = await db.transaction(async (tx) => {
      const document = await lockDocument(tx, documentId);
      if (!["ENCODED", "RETURNED_FOR_CORRECTION"].includes(document.currentStatus)) {
        throw new InvalidTransitionError("Only encoded or returned documents can be forwarded.");
      }

      const [focal] = await tx
        .select({ id: focalPersons.id, isActive: focalPersons.isActive, officeId: focalPersons.officeId })
        .from(focalPersons)
        .where(eq(focalPersons.id, parsed.data.focalPersonId))
        .limit(1);
      if (!focal || !focal.isActive) {
        throw new ForbiddenError("Select an active focal person.");
      }
      if (focal.officeId !== document.destinationOfficeId) {
        throw new ForbiddenError("The focal person must belong to the document's destination office.");
      }

      const cycleNumber = await nextCycleNumber(tx, documentId);

      await tx.update(documentAssignments).set({ isCurrent: false }).where(eq(documentAssignments.documentId, documentId));
      await tx.insert(documentAssignments).values({
        documentId,
        cycleNumber,
        focalPersonId: parsed.data.focalPersonId,
        assignedBy: session.user.id,
        notes: parsed.data.remarks || null,
        isCurrent: true,
      });
      await tx.insert(documentForwardings).values({
        documentId,
        cycleNumber,
        focalPersonId: parsed.data.focalPersonId,
        forwardedAt,
        forwardedBy: session.user.id,
        remarks: parsed.data.remarks || null,
      });

      await applyStatusChange({
        executor: tx,
        documentId,
        action: document.currentStatus === "RETURNED_FOR_CORRECTION" ? "RE_FORWARD" : "FORWARD",
        currentStatus: document.currentStatus,
        actorUserId: session.user.id,
        reason: parsed.data.remarks || null,
        extraValues: { intendedFocalPersonId: parsed.data.focalPersonId },
        metadata: { cycleNumber, focalPersonId: parsed.data.focalPersonId, forwardedAt: forwardedAt.toISOString() },
      });
      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: document.currentStatus === "RETURNED_FOR_CORRECTION" ? "DOCUMENT_REFORWARDED" : "DOCUMENT_FORWARDED",
        entityType: "document",
        entityId: documentId,
        entityLabel: document.trackingNumber,
        details: { cycleNumber, focalPersonId: parsed.data.focalPersonId },
      });
      return cycleNumber;
    });

    return success({ id: documentId, cycleNumber: result });
  });
}

export async function recordReviewDecision(documentId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("document:record-decision");
    const parsed = recordDecisionSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    if (parsed.data.receivedByUserId) {
      const [receiver] = await db.select({ id: user.id }).from(user).where(eq(user.id, parsed.data.receivedByUserId)).limit(1);
      if (!receiver) return failure("NOT_FOUND", "The selected receiving personnel does not exist.");
    }

    await db.transaction(async (tx) => {
      const document = await lockDocument(tx, documentId);
      if (document.currentStatus !== "FORWARDED_TO_FOCAL_PERSON") {
        throw new InvalidTransitionError("A review result can only be recorded while the document is forwarded.");
      }

      const [latestForwarding] = await tx
        .select({ id: documentForwardings.id, focalPersonId: documentForwardings.focalPersonId })
        .from(documentForwardings)
        .where(eq(documentForwardings.documentId, documentId))
        .orderBy(desc(documentForwardings.cycleNumber))
        .limit(1);
      if (!latestForwarding || latestForwarding.focalPersonId !== parsed.data.focalPersonId) {
        throw new ForbiddenError("Only the focal person for the current forwarding cycle can be recorded.");
      }

      const [focal] = await tx
        .select({ id: focalPersons.id, isActive: focalPersons.isActive })
        .from(focalPersons)
        .where(eq(focalPersons.id, parsed.data.focalPersonId))
        .limit(1);
      if (!focal || !focal.isActive) {
        throw new ForbiddenError("The focal person for this cycle is no longer active.");
      }

      // The physical decision and the application user who enters it are always
      // stored in separate columns.
      const [review] = await tx
        .insert(documentReviews)
        .values({
          documentId,
          forwardingId: latestForwarding?.id ?? null,
          focalPersonId: parsed.data.focalPersonId,
          decision: parsed.data.decision,
          decisionDate: parsed.data.decisionDate || null,
          remarks: parsed.data.remarks || null,
          recordedBy: session.user.id,
          recordedAt: new Date(),
          returnedToReceivingAt: parseDateTime(parsed.data.returnedToReceivingAt),
        })
        .returning({ id: documentReviews.id });

      if (parsed.data.decision === "RETURNED_FOR_CORRECTION") {
        await tx.insert(documentReturns).values({
          documentId,
          reviewId: review.id,
          returnRemarks: parsed.data.remarks ?? "",
          receivedByUserId: parsed.data.receivedByUserId || session.user.id,
          receivedAt: parseDateTime(parsed.data.returnedToReceivingAt),
        });
      }

      await applyStatusChange({
        executor: tx,
        documentId,
        action: parsed.data.decision === "APPROVED" ? "RECORD_APPROVAL" : "RECORD_RETURN",
        currentStatus: document.currentStatus,
        actorUserId: session.user.id,
        reason: parsed.data.remarks || null,
        metadata: {
          focalPersonId: parsed.data.focalPersonId,
          recordedBy: session.user.id,
          decisionDate: parsed.data.decisionDate || null,
          reviewId: review.id,
        },
      });
      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: parsed.data.decision === "APPROVED" ? "REVIEW_APPROVAL_RECORDED" : "REVIEW_RETURN_RECORDED",
        entityType: "document",
        entityId: documentId,
        entityLabel: document.trackingNumber,
        details: {
          focalPersonId: parsed.data.focalPersonId,
          decision: parsed.data.decision,
          recordedBy: session.user.id,
        },
      });
    });

    return success({ id: documentId });
  });
}

export async function recordCorrectiveAction(documentId: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("document:correct");
    const parsed = correctiveActionSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    await db.transaction(async (tx) => {
      const document = await lockDocument(tx, documentId);
      if (document.currentStatus !== "RETURNED_FOR_CORRECTION") {
        throw new InvalidTransitionError("Corrective actions can only be recorded while the document is returned.");
      }
      const [latestReturn] = await tx
        .select({ id: documentReturns.id })
        .from(documentReturns)
        .where(eq(documentReturns.documentId, documentId))
        .orderBy(desc(documentReturns.createdAt), desc(documentReturns.id))
        .limit(1);
      const correctedAt = parseDateTime(parsed.data.correctedAt);

      await tx.insert(documentCorrectiveActions).values({
        documentId,
        returnId: latestReturn?.id ?? null,
        actionTaken: parsed.data.actionTaken,
        correctedAt,
        recordedBy: session.user.id,
      });
      await applyStatusChange({
        executor: tx,
        documentId,
        action: "RECORD_CORRECTIVE_ACTION",
        currentStatus: document.currentStatus,
        actorUserId: session.user.id,
        reason: parsed.data.actionTaken,
        metadata: { returnId: latestReturn?.id ?? null, correctedAt: correctedAt?.toISOString() ?? null },
      });
      await recordActivity({
        executor: tx,
        actorUserId: session.user.id,
        action: "CORRECTIVE_ACTION_RECORDED",
        entityType: "document",
        entityId: documentId,
        entityLabel: document.trackingNumber,
        details: { returnId: latestReturn?.id ?? null, actionTaken: parsed.data.actionTaken },
      });
    });

    return success({ id: documentId });
  });
}

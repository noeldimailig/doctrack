import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { activityLogs, documentStatusHistory, documents } from "@/lib/db/schema";
import { InvalidTransitionError, NotFoundError } from "@/lib/error/app-error";
import { resolveTransition, type DocumentStatus, type WorkflowAction } from "./status";

/** Accepts either the root Drizzle client or a transaction client. */
type DbExecutor = Pick<typeof db, "select" | "insert" | "update">;

export interface LockedDocument {
  id: string;
  currentStatus: DocumentStatus;
  trackingNumber: string;
  title: string;
  destinationOfficeId: string | null;
}

export async function lockDocument(executor: DbExecutor, id: string): Promise<LockedDocument> {
  const [document] = await executor
    .select({
      id: documents.id,
      currentStatus: documents.currentStatus,
      trackingNumber: documents.trackingNumber,
      title: documents.title,
      destinationOfficeId: documents.destinationOfficeId,
    })
    .from(documents)
    .where(eq(documents.id, id))
    .for("update")
    .limit(1);
  if (!document) throw new NotFoundError("Document not found.");
  return document;
}

export function assertTransition(action: WorkflowAction, currentStatus: DocumentStatus): DocumentStatus {
  const transition = resolveTransition(action, currentStatus);
  if (!transition) {
    throw new InvalidTransitionError(`Cannot ${action.toLowerCase().replaceAll("_", " ")} from ${currentStatus}.`);
  }
  return transition.to;
}

export async function recordStatusChange(input: {
  executor: DbExecutor;
  documentId: string;
  fromStatus: DocumentStatus | null;
  toStatus: DocumentStatus;
  action: WorkflowAction;
  changedBy: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await input.executor.insert(documentStatusHistory).values({
    documentId: input.documentId,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    action: input.action,
    changedBy: input.changedBy,
    reason: input.reason ?? null,
    metadata: input.metadata ?? null,
  });
}

export async function recordActivity(input: {
  executor: DbExecutor;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId: string;
  entityLabel: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await input.executor.insert(activityLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    details: input.details ?? null,
  });
}

export async function applyStatusChange(input: {
  executor: DbExecutor;
  documentId: string;
  action: WorkflowAction;
  currentStatus: DocumentStatus;
  actorUserId: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
  extraValues?: Partial<typeof documents.$inferInsert>;
}): Promise<DocumentStatus> {
  const toStatus = assertTransition(input.action, input.currentStatus);
  await input.executor
    .update(documents)
    .set({ currentStatus: toStatus, updatedAt: new Date(), ...input.extraValues })
    .where(eq(documents.id, input.documentId));
  await recordStatusChange({
    executor: input.executor,
    documentId: input.documentId,
    fromStatus: input.currentStatus,
    toStatus,
    action: input.action,
    changedBy: input.actorUserId,
    reason: input.reason,
    metadata: input.metadata,
  });
  return toStatus;
}

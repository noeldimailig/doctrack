import { headers } from "next/headers";
import { db } from "@/lib/db";
import { activityLogs } from "@/lib/db/schema";

export interface ActivityInput {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId?: string;
  entityLabel?: string;
  details?: Record<string, unknown>;
  includeRequestMetadata?: boolean;
}

/** Appends an immutable audit event. Never update or delete these rows. */
export async function logActivity(input: ActivityInput): Promise<void> {
  let ipAddress: string | null = null;
  let userAgent: string | null = null;

  if (input.includeRequestMetadata !== false) {
    try {
      const requestHeaders = await headers();
      ipAddress =
        requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        requestHeaders.get("x-real-ip") ??
        null;
      userAgent = requestHeaders.get("user-agent");
    } catch {
      // Called outside a request (for example from a maintenance script).
    }
  }

  await db.insert(activityLogs).values({
    actorUserId: input.actorUserId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    details: input.details,
    ipAddress,
    userAgent,
  });
}

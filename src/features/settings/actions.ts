"use server";

import { logActivity } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";
import { runAction } from "@/lib/error/action";
import { failure, failureFromZod, success, type ActionResult } from "@/lib/error/action-result";
import { systemSettingSchema } from "./validation";

export async function upsertSystemSetting(input: unknown): Promise<ActionResult<{ key: string }>> {
  return runAction(async () => {
    const session = await requirePermission("settings:manage");
    const parsed = systemSettingSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    let value: unknown;
    try {
      value = JSON.parse(parsed.data.value);
    } catch {
      return failure("VALIDATION_ERROR", "The setting value must be valid JSON.");
    }

    await db
      .insert(systemSettings)
      .values({
        key: parsed.data.key,
        value,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: { value, updatedBy: session.user.id, updatedAt: new Date() },
      });

    await logActivity({
      actorUserId: session.user.id,
      action: "SYSTEM_SETTING_UPDATED",
      entityType: "system_setting",
      entityLabel: parsed.data.key,
      details: { key: parsed.data.key },
    });

    return success({ key: parsed.data.key });
  });
}

"use server";

import { and, eq, ne, sql } from "drizzle-orm";
import { logActivity } from "@/lib/audit";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { departments, focalPersons, offices } from "@/lib/db/schema";
import { runAction } from "@/lib/error/action";
import { failure, failureFromZod, success, type ActionResult } from "@/lib/error/action-result";
import { departmentSchema, focalPersonSchema, officeSchema } from "./validation";

function identifier(value: string | null | undefined): string | null {
  return value ? value : null;
}

export async function createOffice(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("office:manage");
    const parsed = officeSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const code = parsed.data.code.toUpperCase();
    const [duplicate] = await db
      .select({ id: offices.id })
      .from(offices)
      .where(sql`lower(${offices.code}) = ${code.toLowerCase()}`)
      .limit(1);
    if (duplicate) return failure("CONFLICT", "An office with this code already exists.");

    if (parsed.data.parentOfficeId) {
      const [parent] = await db.select({ id: offices.id }).from(offices).where(eq(offices.id, parsed.data.parentOfficeId)).limit(1);
      if (!parent) return failure("NOT_FOUND", "The selected parent office does not exist.");
    }

    const [created] = await db
      .insert(offices)
      .values({
        code,
        name: parsed.data.name,
        shortName: identifier(parsed.data.shortName),
        parentOfficeId: identifier(parsed.data.parentOfficeId),
      })
      .returning({ id: offices.id });

    await logActivity({
      actorUserId: session.user.id,
      action: "OFFICE_CREATED",
      entityType: "office",
      entityId: created.id,
      entityLabel: created.id,
      details: { code, name: parsed.data.name },
    });

    return success({ id: created.id });
  });
}

export async function updateOffice(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("office:manage");
    const parsed = officeSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const code = parsed.data.code.toUpperCase();
    const [duplicate] = await db
      .select({ id: offices.id })
      .from(offices)
      .where(and(sql`lower(${offices.code}) = ${code.toLowerCase()}`, ne(offices.id, id)))
      .limit(1);
    if (duplicate) return failure("CONFLICT", "An office with this code already exists.");
    if (parsed.data.parentOfficeId === id) return failure("VALIDATION_ERROR", "An office cannot be its own parent.");

    const [updated] = await db
      .update(offices)
      .set({
        code,
        name: parsed.data.name,
        shortName: identifier(parsed.data.shortName),
        parentOfficeId: identifier(parsed.data.parentOfficeId),
        updatedAt: new Date(),
      })
      .where(eq(offices.id, id))
      .returning({ id: offices.id });
    if (!updated) return failure("NOT_FOUND", "Office not found.");

    await logActivity({
      actorUserId: session.user.id,
      action: "OFFICE_UPDATED",
      entityType: "office",
      entityId: id,
      entityLabel: code,
      details: { name: parsed.data.name },
    });
    return success({ id });
  });
}

export async function setOfficeActive(id: string, isActive: boolean): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("office:manage");
    const [updated] = await db
      .update(offices)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(offices.id, id))
      .returning({ id: offices.id, code: offices.code });
    if (!updated) return failure("NOT_FOUND", "Office not found.");

    await logActivity({
      actorUserId: session.user.id,
      action: isActive ? "OFFICE_ACTIVATED" : "OFFICE_DEACTIVATED",
      entityType: "office",
      entityId: id,
      entityLabel: updated.code,
    });
    return success({ id });
  });
}

export async function createDepartment(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("office:manage");
    const parsed = departmentSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const [office] = await db.select({ id: offices.id }).from(offices).where(eq(offices.id, parsed.data.officeId)).limit(1);
    if (!office) return failure("NOT_FOUND", "The selected office does not exist.");

    const code = parsed.data.code.toUpperCase();
    const [duplicate] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(sql`lower(${departments.code}) = ${code.toLowerCase()}`)
      .limit(1);
    if (duplicate) return failure("CONFLICT", "A department with this code already exists.");

    const [created] = await db
      .insert(departments)
      .values({ officeId: parsed.data.officeId, code, name: parsed.data.name })
      .returning({ id: departments.id });

    await logActivity({
      actorUserId: session.user.id,
      action: "DEPARTMENT_CREATED",
      entityType: "department",
      entityId: created.id,
      entityLabel: code,
      details: { officeId: parsed.data.officeId, name: parsed.data.name },
    });
    return success({ id: created.id });
  });
}

export async function setDepartmentActive(id: string, isActive: boolean): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("office:manage");
    const [updated] = await db
      .update(departments)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(departments.id, id))
      .returning({ id: departments.id, code: departments.code });
    if (!updated) return failure("NOT_FOUND", "Department not found.");

    await logActivity({
      actorUserId: session.user.id,
      action: isActive ? "DEPARTMENT_ACTIVATED" : "DEPARTMENT_DEACTIVATED",
      entityType: "department",
      entityId: id,
      entityLabel: updated.code,
    });
    return success({ id });
  });
}

export async function createFocalPerson(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("focal-person:manage");
    const parsed = focalPersonSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const officeId = identifier(parsed.data.officeId);
    const departmentId = identifier(parsed.data.departmentId);
    if (officeId) {
      const [office] = await db.select({ id: offices.id }).from(offices).where(eq(offices.id, officeId)).limit(1);
      if (!office) return failure("NOT_FOUND", "The selected office does not exist.");
    }
    if (departmentId) {
      const [department] = await db
        .select({ id: departments.id, officeId: departments.officeId })
        .from(departments)
        .where(eq(departments.id, departmentId))
        .limit(1);
      if (!department) return failure("NOT_FOUND", "The selected department does not exist.");
      if (officeId && department.officeId !== officeId) {
        return failure("VALIDATION_ERROR", "The selected department does not belong to the selected office.");
      }
    }

    // Focal persons are directory records only: no user, account or session row.
    const [created] = await db
      .insert(focalPersons)
      .values({
        fullName: parsed.data.fullName,
        officeId,
        departmentId,
        position: parsed.data.position,
        contactEmail: identifier(parsed.data.contactEmail),
        contactNumber: identifier(parsed.data.contactNumber),
      })
      .returning({ id: focalPersons.id });

    await logActivity({
      actorUserId: session.user.id,
      action: "FOCAL_PERSON_CREATED",
      entityType: "focal_person",
      entityId: created.id,
      entityLabel: parsed.data.fullName,
      details: { officeId, departmentId },
    });
    return success({ id: created.id });
  });
}

export async function updateFocalPerson(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("focal-person:manage");
    const parsed = focalPersonSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const officeId = identifier(parsed.data.officeId);
    const departmentId = identifier(parsed.data.departmentId);
    if (departmentId) {
      const [department] = await db
        .select({ id: departments.id, officeId: departments.officeId })
        .from(departments)
        .where(eq(departments.id, departmentId))
        .limit(1);
      if (!department) return failure("NOT_FOUND", "The selected department does not exist.");
      if (officeId && department.officeId !== officeId) {
        return failure("VALIDATION_ERROR", "The selected department does not belong to the selected office.");
      }
    }

    const [updated] = await db
      .update(focalPersons)
      .set({
        fullName: parsed.data.fullName,
        officeId,
        departmentId,
        position: parsed.data.position,
        contactEmail: identifier(parsed.data.contactEmail),
        contactNumber: identifier(parsed.data.contactNumber),
        updatedAt: new Date(),
      })
      .where(eq(focalPersons.id, id))
      .returning({ id: focalPersons.id });
    if (!updated) return failure("NOT_FOUND", "Focal person not found.");

    await logActivity({
      actorUserId: session.user.id,
      action: "FOCAL_PERSON_UPDATED",
      entityType: "focal_person",
      entityId: id,
      entityLabel: parsed.data.fullName,
    });
    return success({ id });
  });
}

export async function setFocalPersonActive(id: string, isActive: boolean): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("focal-person:manage");
    const [updated] = await db
      .update(focalPersons)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(focalPersons.id, id))
      .returning({ id: focalPersons.id, fullName: focalPersons.fullName });
    if (!updated) return failure("NOT_FOUND", "Focal person not found.");

    await logActivity({
      actorUserId: session.user.id,
      action: isActive ? "FOCAL_PERSON_ACTIVATED" : "FOCAL_PERSON_DEACTIVATED",
      entityType: "focal_person",
      entityId: id,
      entityLabel: updated.fullName,
    });
    return success({ id });
  });
}

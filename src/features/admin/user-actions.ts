"use server";

import { headers } from "next/headers";
import { and, eq, inArray } from "drizzle-orm";
import { logActivity } from "@/lib/audit";
import { auth } from "@/lib/auth/auth";
import { ROLE_KEYS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  departments,
  permissions,
  rolePermissions,
  roles,
  user,
  userOrganisations,
  userRoles,
} from "@/lib/db/schema";
import { runAction } from "@/lib/error/action";
import { failure, failureFromZod, success, type ActionResult } from "@/lib/error/action-result";
import { createUserSchema, rolePermissionsSchema, setPasswordSchema, updateUserSchema } from "./validation";

type AppRoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

async function authHeaders(): Promise<Headers> {
  return await headers();
}

async function resolveRoles(roleKeys: AppRoleKey[]) {
  return db.select({ id: roles.id, key: roles.key }).from(roles).where(and(inArray(roles.key, roleKeys), eq(roles.isActive, true)));
}

async function syncUserRoles(userId: string, roleKeys: AppRoleKey[]): Promise<void> {
  const roleRows = await resolveRoles(roleKeys);
  if (roleRows.length !== new Set(roleKeys).size) {
    throw new Error("One or more selected roles are unavailable.");
  }

  await db.transaction(async (tx) => {
    await tx.delete(userRoles).where(eq(userRoles.userId, userId));
    await tx.insert(userRoles).values(roleRows.map((role) => ({ userId, roleId: role.id })));
  });
}

async function syncUserOrganisation(
  userId: string,
  officeId: string | null | undefined,
  departmentId: string | null | undefined,
): Promise<void> {
  if (departmentId) {
    const [department] = await db
      .select({ id: departments.id })
      .from(departments)
      .where(eq(departments.id, departmentId))
      .limit(1);
    if (!department) throw new Error("The selected department does not exist.");
  }

  await db
    .insert(userOrganisations)
    .values({
      userId,
      officeId: officeId ?? null,
      departmentId: departmentId ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userOrganisations.userId,
      set: {
        officeId: officeId ?? null,
        departmentId: departmentId ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function createApplicationUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("user:manage");
    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const email = parsed.data.email.toLowerCase();
    const [duplicate] = await db.select({ id: user.id }).from(user).where(eq(user.email, email)).limit(1);
    if (duplicate) return failure("CONFLICT", "An application user with this email already exists.");

    const roleKeys = [...new Set(parsed.data.roleKeys)];
    const roleRows = await resolveRoles(roleKeys);
    if (roleRows.length !== roleKeys.length) return failure("VALIDATION_ERROR", "One or more selected roles are unavailable.");

    const created = await auth.api.createUser({
      body: { name: parsed.data.name, email, password: parsed.data.password, role: roleKeys },
      headers: await authHeaders(),
    });

    await db.transaction(async (tx) => {
      await tx.insert(userRoles).values(roleRows.map((role) => ({ userId: created.user.id, roleId: role.id })));
      await tx.insert(userOrganisations).values({
        userId: created.user.id,
        officeId: parsed.data.officeId ?? null,
        departmentId: parsed.data.departmentId ?? null,
      });
    });

    await logActivity({
      actorUserId: session.user.id,
      action: "USER_CREATED",
      entityType: "user",
      entityId: created.user.id,
      entityLabel: email,
      details: { roleKeys, officeId: parsed.data.officeId ?? null },
    });
    return success({ id: created.user.id });
  });
}

export async function updateApplicationUser(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("user:manage");
    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const roleKeys = [...new Set(parsed.data.roleKeys)];
    if (id === session.user.id && !roleKeys.includes(ROLE_KEYS.ADMIN)) {
      return failure("FORBIDDEN", "You cannot remove your own administrator role.");
    }

    await auth.api.adminUpdateUser({
      body: { userId: id, data: { name: parsed.data.name } },
      headers: await authHeaders(),
    });
    await auth.api.setRole({
      body: { userId: id, role: roleKeys },
      headers: await authHeaders(),
    });
    await syncUserRoles(id, roleKeys);
    await syncUserOrganisation(id, parsed.data.officeId ?? null, parsed.data.departmentId ?? null);

    await logActivity({
      actorUserId: session.user.id,
      action: "USER_UPDATED",
      entityType: "user",
      entityId: id,
      entityLabel: parsed.data.name,
      details: { roleKeys },
    });
    return success({ id });
  });
}

export async function setApplicationUserPassword(id: string, input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("user:manage");
    const parsed = setPasswordSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    await auth.api.setUserPassword({
      body: { userId: id, newPassword: parsed.data.password },
      headers: await authHeaders(),
    });

    await logActivity({
      actorUserId: session.user.id,
      action: "USER_PASSWORD_RESET",
      entityType: "user",
      entityId: id,
      details: { method: "administrator-reset" },
    });
    return success({ id });
  });
}

export async function setApplicationUserActive(id: string, isActive: boolean): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("user:manage");
    if (id === session.user.id && !isActive) {
      return failure("FORBIDDEN", "You cannot deactivate your own account.");
    }

    if (isActive) {
      await auth.api.unbanUser({ body: { userId: id }, headers: await authHeaders() });
    } else {
      await auth.api.banUser({
        body: { userId: id, banReason: "Deactivated by administrator" },
        headers: await authHeaders(),
      });
      await auth.api.revokeUserSessions({ body: { userId: id }, headers: await authHeaders() });
    }

    await logActivity({
      actorUserId: session.user.id,
      action: isActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityType: "user",
      entityId: id,
    });
    return success({ id });
  });
}

export async function revokeUserSessions(id: string): Promise<ActionResult<{ id: string }>> {
  return runAction(async () => {
    const session = await requirePermission("user:manage");
    await auth.api.revokeUserSessions({ body: { userId: id }, headers: await authHeaders() });
    await logActivity({
      actorUserId: session.user.id,
      action: "USER_SESSIONS_REVOKED",
      entityType: "user",
      entityId: id,
    });
    return success({ id });
  });
}

export async function setRolePermissions(roleId: string, input: unknown): Promise<ActionResult<{ roleId: string }>> {
  return runAction(async () => {
    const session = await requirePermission("user:manage");
    const parsed = rolePermissionsSchema.safeParse(input);
    if (!parsed.success) return failureFromZod(parsed.error);

    const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId)).limit(1);
    if (!role) return failure("NOT_FOUND", "Role not found.");

    const permissionKeys = [...new Set(parsed.data.permissionKeys)];
    const permissionRows = permissionKeys.length
      ? await db.select({ id: permissions.id, key: permissions.key }).from(permissions).where(inArray(permissions.key, permissionKeys))
      : [];
    if (permissionRows.length !== permissionKeys.length) {
      return failure("VALIDATION_ERROR", "One or more selected permissions are unavailable.");
    }

    await db.transaction(async (tx) => {
      await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
      if (permissionRows.length > 0) {
        await tx.insert(rolePermissions).values(permissionRows.map((permission) => ({ roleId, permissionId: permission.id })));
      }
    });

    await logActivity({
      actorUserId: session.user.id,
      action: "ROLE_PERMISSIONS_UPDATED",
      entityType: "role",
      entityId: roleId,
      details: { permissionKeys },
    });
    return success({ roleId });
  });
}

import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { permissions, rolePermissions, roles, userRoles } from "@/lib/db/schema";
import {
  PERMISSION_KEYS,
  ROLE_KEYS,
  ROLE_PERMISSION_MAP,
  type PermissionKey,
} from "./rbac-definitions";

export { PERMISSION_KEYS, ROLE_KEYS, ROLE_PERMISSION_MAP, type PermissionKey };
export type { RoleKey } from "./rbac-definitions";

export async function getUserRoleKeys(userId: string): Promise<string[]> {
  const rows = await db
    .select({ key: roles.key })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true), eq(roles.isActive, true)));

  return rows.map((row) => row.key);
}

export async function getUserPermissionKeys(userId: string): Promise<PermissionKey[]> {
  const rows = await db
    .select({ key: permissions.key })
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
    .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .where(
      and(
        eq(userRoles.userId, userId),
        eq(userRoles.isActive, true),
        eq(roles.isActive, true),
        eq(rolePermissions.isActive, true),
      ),
    );

  return rows.map((row) => row.key as PermissionKey);
}

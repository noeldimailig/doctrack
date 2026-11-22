import { and, asc, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  departments,
  focalPersons,
  offices,
  permissions,
  rolePermissions,
  roles,
  user,
  userOrganisations,
  userRoles,
} from "@/lib/db/schema";

export interface OfficeListItem {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  parentOfficeId: string | null;
  parentName: string | null;
  isActive: boolean;
  departmentCount: number;
}

export async function listOffices(search = ""): Promise<OfficeListItem[]> {
  const parent = alias(offices, "parent");
  const rows = await db
    .select({
      id: offices.id,
      code: offices.code,
      name: offices.name,
      shortName: offices.shortName,
      isActive: offices.isActive,
      parentOfficeId: offices.parentOfficeId,
      parentName: parent.name,
      departmentCount: sql<number>`count(${departments.id})::int`,
    })
    .from(offices)
    .leftJoin(parent, eq(parent.id, offices.parentOfficeId))
    .leftJoin(departments, and(eq(departments.officeId, offices.id), eq(departments.isActive, true)))
    .where(search ? or(ilike(offices.name, `%${search}%`), ilike(offices.code, `%${search}%`)) : undefined)
    .groupBy(offices.id, parent.name)
    .orderBy(asc(offices.name));

  return rows;
}

export async function listDepartments(officeId?: string): Promise<Array<{ id: string; code: string; name: string; officeName: string; isActive: boolean }>> {
  const rows = await db
    .select({
      id: departments.id,
      code: departments.code,
      name: departments.name,
      isActive: departments.isActive,
      officeName: offices.name,
    })
    .from(departments)
    .innerJoin(offices, eq(departments.officeId, offices.id))
    .where(officeId ? eq(departments.officeId, officeId) : undefined)
    .orderBy(asc(offices.name), asc(departments.name));
  return rows;
}

export interface FocalPersonListItem {
  id: string;
  fullName: string;
  position: string;
  officeId: string | null;
  departmentId: string | null;
  officeName: string | null;
  departmentName: string | null;
  contactEmail: string | null;
  contactNumber: string | null;
  isActive: boolean;
}

export async function listFocalPersons(search = ""): Promise<FocalPersonListItem[]> {
  const rows = await db
    .select({
      id: focalPersons.id,
      fullName: focalPersons.fullName,
      position: focalPersons.position,
      officeId: focalPersons.officeId,
      departmentId: focalPersons.departmentId,
      officeName: offices.name,
      departmentName: departments.name,
      contactEmail: focalPersons.contactEmail,
      contactNumber: focalPersons.contactNumber,
      isActive: focalPersons.isActive,
    })
    .from(focalPersons)
    .leftJoin(offices, eq(focalPersons.officeId, offices.id))
    .leftJoin(departments, eq(focalPersons.departmentId, departments.id))
    .where(
      search
        ? or(ilike(focalPersons.fullName, `%${search}%`), ilike(focalPersons.position, `%${search}%`))
        : undefined,
    )
    .orderBy(asc(focalPersons.fullName));
  return rows;
}

export interface UserListItem {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  banned: boolean | null;
  createdAt: Date;
  roleKeys: string[];
  officeId: string | null;
  departmentId: string | null;
  officeName: string | null;
  departmentName: string | null;
}

export async function listUsers(search = ""): Promise<UserListItem[]> {
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      banned: user.banned,
      createdAt: user.createdAt,
      roleKeys: sql<string[]>`coalesce(array_agg(${roles.key}) filter (where ${roles.id} is not null), '{}')`,
      officeId: userOrganisations.officeId,
      departmentId: userOrganisations.departmentId,
      officeName: offices.name,
      departmentName: departments.name,
    })
    .from(user)
    .leftJoin(userRoles, and(eq(userRoles.userId, user.id), eq(userRoles.isActive, true)))
    .leftJoin(roles, and(eq(roles.id, userRoles.roleId), eq(roles.isActive, true)))
    .leftJoin(userOrganisations, eq(userOrganisations.userId, user.id))
    .leftJoin(offices, eq(offices.id, userOrganisations.officeId))
    .leftJoin(departments, eq(departments.id, userOrganisations.departmentId))
    .where(search ? or(ilike(user.name, `%${search}%`), ilike(user.email, `%${search}%`)) : undefined)
    .groupBy(user.id, userOrganisations.officeId, userOrganisations.departmentId, offices.name, departments.name)
    .orderBy(desc(user.createdAt));
  return rows;
}

export async function listRolesWithPermissions() {
  const rows = await db
    .select({
      roleId: roles.id,
      roleKey: roles.key,
      roleName: roles.name,
      roleDescription: roles.description,
      permissionKey: permissions.key,
    })
    .from(roles)
    .leftJoin(rolePermissions, and(eq(rolePermissions.roleId, roles.id), eq(rolePermissions.isActive, true)))
    .leftJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
    .orderBy(asc(roles.key), asc(permissions.key));

  const grouped = new Map<string, { id: string; key: string; name: string; description: string | null; permissions: string[] }>();
  for (const row of rows) {
    const current = grouped.get(row.roleId) ?? {
      id: row.roleId,
      key: row.roleKey,
      name: row.roleName,
      description: row.roleDescription,
      permissions: [],
    };
    if (row.permissionKey) current.permissions.push(row.permissionKey);
    grouped.set(row.roleId, current);
  }
  return [...grouped.values()];
}

export async function listPermissions() {
  return db.select({ id: permissions.id, key: permissions.key, description: permissions.description }).from(permissions).orderBy(asc(permissions.key));
}

export async function getActiveOffices() {
  return db.select({ id: offices.id, code: offices.code, name: offices.name }).from(offices).where(eq(offices.isActive, true)).orderBy(asc(offices.name));
}

export async function getActiveDepartments(officeId?: string) {
  return db
    .select({ id: departments.id, code: departments.code, name: departments.name, officeId: departments.officeId })
    .from(departments)
    .where(and(eq(departments.isActive, true), officeId ? eq(departments.officeId, officeId) : undefined))
    .orderBy(asc(departments.name));
}

export async function getActiveFocalPersons() {
  return db
    .select({
      id: focalPersons.id,
      fullName: focalPersons.fullName,
      position: focalPersons.position,
      officeId: focalPersons.officeId,
      officeName: offices.name,
    })
    .from(focalPersons)
    .leftJoin(offices, eq(focalPersons.officeId, offices.id))
    .where(eq(focalPersons.isActive, true))
    .orderBy(asc(focalPersons.fullName));
}

export async function getApplicationUsers() {
  return db
    .select({ id: user.id, name: user.name, email: user.email, banned: user.banned })
    .from(user)
    .orderBy(asc(user.name));
}

export async function countUsers(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(user);
  return row?.value ?? 0;
}

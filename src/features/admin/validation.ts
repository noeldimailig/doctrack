import { z } from "zod";

export const officeSchema = z.object({
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, hyphens or underscores."),
  name: z.string().trim().min(2).max(255),
  shortName: z.string().trim().max(120).optional().or(z.literal("")),
  parentOfficeId: z.string().uuid().nullable().optional(),
});

export const departmentSchema = z.object({
  officeId: z.string().uuid(),
  code: z.string().trim().min(2).max(32).regex(/^[A-Z0-9_-]+$/i, "Use letters, numbers, hyphens or underscores."),
  name: z.string().trim().min(2).max(255),
});

export const focalPersonSchema = z.object({
  fullName: z.string().trim().min(2).max(255),
  officeId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
  position: z.string().trim().min(2).max(255),
  contactEmail: z.union([z.email(), z.literal("")]).optional(),
  contactNumber: z.string().trim().max(64).optional().or(z.literal("")),
});

export const userOrganisationSchema = z.object({
  userId: z.string().min(1),
  officeId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(255),
  email: z.email(),
  password: z.string().min(12).max(256),
  roleKeys: z.array(z.enum(["ADMIN", "RECEIVING_PERSONNEL", "VIEWER"])).min(1),
  officeId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(255),
  roleKeys: z.array(z.enum(["ADMIN", "RECEIVING_PERSONNEL", "VIEWER"])).min(1),
  officeId: z.string().uuid().nullable().optional(),
  departmentId: z.string().uuid().nullable().optional(),
});

export const setPasswordSchema = z.object({
  password: z.string().min(12).max(256),
});

export const rolePermissionsSchema = z.object({
  permissionKeys: z.array(z.string().min(1)),
});

export type OfficeInput = z.infer<typeof officeSchema>;
export type DepartmentInput = z.infer<typeof departmentSchema>;
export type FocalPersonInput = z.infer<typeof focalPersonSchema>;

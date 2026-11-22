/**
 * Pure RBAC definitions. Kept separate from the database-backed permission
 * queries so validators, scripts and tests can import them without opening a
 * database connection.
 */

export const ROLE_KEYS = {
  ADMIN: "ADMIN",
  RECEIVING_PERSONNEL: "RECEIVING_PERSONNEL",
  VIEWER: "VIEWER",
} as const;

export type RoleKey = (typeof ROLE_KEYS)[keyof typeof ROLE_KEYS];

export const PERMISSION_KEYS = [
  "document:create",
  "document:read",
  "document:update",
  "document:forward",
  "document:record-decision",
  "document:correct",
  "document:cancel",
  "transmittal:create",
  "transmittal:finalize",
  "transmittal:read",
  "report:export",
  "activity:read",
  "user:manage",
  "office:manage",
  "focal-person:manage",
  "settings:manage",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const ROLE_PERMISSION_MAP: Record<RoleKey, readonly PermissionKey[]> = {
  ADMIN: PERMISSION_KEYS,
  RECEIVING_PERSONNEL: [
    "document:create",
    "document:read",
    "document:update",
    "document:forward",
    "document:record-decision",
    "document:correct",
    "transmittal:create",
    "transmittal:finalize",
    "transmittal:read",
    "report:export",
    "activity:read",
  ],
  VIEWER: ["document:read", "transmittal:read"],
};

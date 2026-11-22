import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Better Auth admin-plugin roles. These are deliberately separate from the
 * application's authoritative custom RBAC tables, but use the same uppercase
 * keys so an administrator's `user.role` value works with both systems.
 */
export const authAccessControl = createAccessControl(defaultStatements);

export const betterAuthRoles = {
  ADMIN: authAccessControl.newRole(adminAc.statements),
  RECEIVING_PERSONNEL: authAccessControl.newRole({ user: [], session: [] }),
  VIEWER: authAccessControl.newRole({ user: [], session: [] }),
};

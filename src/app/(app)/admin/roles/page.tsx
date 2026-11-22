import { PageHeader } from "@/components/layout/page-header";
import { RolePermissionsPanel } from "@/features/admin/components/role-permissions-panel";
import { listPermissions, listRolesWithPermissions } from "@/features/admin/queries";
import { setRolePermissions } from "@/features/admin/user-actions";
import { requirePermission } from "@/lib/auth/session";

export const instant = false;

export default async function RolesPage() {
  await requirePermission("user:manage");
  const [roles, permissions] = await Promise.all([listRolesWithPermissions(), listPermissions()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles and Permissions"
        description="Application permissions are checked on the server. Changes take effect on the next request."
      />
      <RolePermissionsPanel roles={roles} permissions={permissions} action={setRolePermissions} />
    </div>
  );
}

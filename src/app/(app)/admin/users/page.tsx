import { PageHeader } from "@/components/layout/page-header";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { SearchForm } from "@/components/shared/search-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PasswordResetDialog } from "@/features/admin/components/password-reset-dialog";
import { UserFormDialog } from "@/features/admin/components/user-form-dialog";
import { getActiveDepartments, getActiveOffices } from "@/features/admin/queries";
import {
  createApplicationUser,
  revokeUserSessions,
  setApplicationUserActive,
  setApplicationUserPassword,
  updateApplicationUser,
} from "@/features/admin/user-actions";
import { listUsers } from "@/features/admin/queries";
import { ROLE_KEYS } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";

interface UsersPageProps {
  searchParams: Promise<{ q?: string }>;
}

export const instant = false;

const ROLE_OPTIONS = Object.values(ROLE_KEYS).map((key) => ({
  key,
  name: key.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()),
}));

export default async function UsersPage({ searchParams }: UsersPageProps) {
  await requirePermission("user:manage");
  const { q = "" } = await searchParams;
  const [users, offices, departments] = await Promise.all([
    listUsers(q),
    getActiveOffices(),
    getActiveDepartments(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Administrator-only application accounts and role assignments."
        actions={<UserFormDialog action={createApplicationUser} roles={ROLE_OPTIONS} offices={offices} departments={departments} />}
      />

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Application users</CardTitle>
            <CardDescription>{users.length} account(s). Focal persons are not listed here.</CardDescription>
          </div>
          <SearchForm action="/admin/users" defaultValue={q} placeholder="Search users..." />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No application users found.
                  </TableCell>
                </TableRow>
              ) : (
                users.map((appUser) => (
                  <TableRow key={appUser.id}>
                    <TableCell className="font-medium">{appUser.name}</TableCell>
                    <TableCell className="text-xs">{appUser.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {appUser.roleKeys.length ? (
                          appUser.roleKeys.map((roleKey) => (
                            <Badge key={roleKey} variant="secondary" className="text-[10px]">
                              {roleKey.replaceAll("_", " ")}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline" className="text-[10px]">No role</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span>{appUser.officeName ?? "—"}</span>
                      {appUser.departmentName ? (
                        <span className="block text-xs text-muted-foreground">{appUser.departmentName}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant={appUser.banned ? "destructive" : "default"}>
                        {appUser.banned ? "Deactivated" : "Active"}
                      </Badge>
                      {!appUser.emailVerified ? (
                        <span className="block text-[10px] text-muted-foreground">Email unverified</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {appUser.createdAt.toLocaleDateString("en-PH")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <UserFormDialog
                          action={updateApplicationUser.bind(null, appUser.id)}
                          roles={ROLE_OPTIONS}
                          offices={offices}
                          departments={departments}
                          initialValues={{
                            id: appUser.id,
                            name: appUser.name,
                            roleKeys: appUser.roleKeys,
                            officeId: appUser.officeId,
                            departmentId: appUser.departmentId,
                          }}
                        />
                        <PasswordResetDialog action={setApplicationUserPassword.bind(null, appUser.id)} userName={appUser.name} />
                        <ConfirmActionButton
                          label="Revoke sessions"
                          title="Revoke all sessions?"
                          description="The user will be signed out on every device. Their account remains active."
                          action={revokeUserSessions.bind(null, appUser.id)}
                        />
                        <ConfirmActionButton
                          label={appUser.banned ? "Activate" : "Deactivate"}
                          title={appUser.banned ? "Activate account?" : "Deactivate account?"}
                          description={appUser.banned ? "The user can sign in again." : "All current sessions will be revoked."}
                          action={setApplicationUserActive.bind(null, appUser.id, Boolean(appUser.banned))}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

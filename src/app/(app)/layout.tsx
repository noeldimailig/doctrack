import { Sidebar } from "@/components/layout/sidebar";
import { UserMenu } from "@/components/layout/user-menu";
import { requireSession } from "@/lib/auth/session";
import { getUserPermissionKeys } from "@/lib/auth/permissions";

export const instant = false;

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  
  const roleKeys = (session.user as typeof session.user & { roleKeys?: string[] }).roleKeys ?? [];
  const permissions = await getUserPermissionKeys(session.user.id);

  return (
    <div className="flex min-h-screen">
      <Sidebar permissions={permissions} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-4 border-b bg-card px-4 sm:px-6 print:hidden">
          <h1 className="text-sm font-semibold sm:text-base">Office Document Workspace</h1>
          <UserMenu name={session.user.name} email={session.user.email} roleKeys={roleKeys} />
        </header>
        <main className="flex-1 bg-muted/30 p-4 sm:p-6 print:bg-white print:p-0">{children}</main>
      </div>
    </div>
  );
}

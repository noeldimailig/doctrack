import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SettingFormDialog } from "@/features/settings/components/setting-form-dialog";
import { listSystemSettings } from "@/features/settings/queries";
import { upsertSystemSetting } from "@/features/settings/actions";
import { requirePermission } from "@/lib/auth/session";

export const instant = false;

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}

export default async function SettingsPage() {
  await requirePermission("settings:manage");
  const settings = await listSystemSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace Settings"
        description="Database-backed configuration values. Application secrets remain in environment variables."
        actions={<SettingFormDialog action={upsertSystemSetting} />}
      />

      <Card>
        <CardHeader>
          <CardTitle>System settings</CardTitle>
          <CardDescription>{settings.length} setting(s) stored in the database.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                    No system settings have been configured.
                  </TableCell>
                </TableRow>
              ) : (
                settings.map((setting) => (
                  <TableRow key={setting.key}>
                    <TableCell className="font-mono text-xs font-medium">{setting.key}</TableCell>
                    <TableCell className="max-w-md">
                      <pre className="overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[11px]">
                        {JSON.stringify(setting.value, null, 2)}
                      </pre>
                    </TableCell>
                    <TableCell className="text-xs">{formatDateTime(setting.updatedAt)}</TableCell>
                    <TableCell className="text-right">
                      <SettingFormDialog
                        action={upsertSystemSetting}
                        initialValues={{
                          key: setting.key,
                          valueText: JSON.stringify(setting.value, null, 2),
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Access control</CardTitle>
          <CardDescription>Roles and permissions are managed from the administration pages.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/users">User management</Link>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link href="/admin/roles">Roles and permissions</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

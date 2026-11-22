import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listActivity, listActivityActions } from "@/features/activity/queries";
import { activityListQuerySchema } from "@/features/activity/validation";
import { requirePermission } from "@/lib/auth/session";

interface ActivityPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const instant = false;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function pageHref(query: Record<string, string | string[] | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    const normalized = first(value);
    if (normalized) params.set(key, normalized);
  }
  params.set("page", String(page));
  return `/activity?${params.toString()}`;
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}

export default async function ActivityPage({ searchParams }: ActivityPageProps) {
  await requirePermission("activity:read");
  const raw = await searchParams;
  const query = activityListQuerySchema.parse({
    q: first(raw.q),
    entityType: first(raw.entityType),
    action: first(raw.action),
    page: first(raw.page) || undefined,
    pageSize: first(raw.pageSize) || undefined,
  });

  const [{ rows, total }, actions] = await Promise.all([listActivity(query), listActivityActions()]);
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Logs"
        description="Immutable audit events written by server-side actions."
      />

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>System activity</CardTitle>
            <CardDescription>{total} event(s) match the current filters.</CardDescription>
          </div>
          <form action="/activity" method="get" className="flex flex-wrap gap-2">
            <Input name="q" defaultValue={query.q} placeholder="Action, record or user" className="max-w-xs" />
            <select name="entityType" defaultValue={query.entityType} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">All record types</option>
              <option value="document">Documents</option>
              <option value="transmittal">Transmittals</option>
              <option value="user">Users</option>
              <option value="office">Offices</option>
              <option value="role">Roles</option>
            </select>
            <select name="action" defaultValue={query.action} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">All actions</option>
              {actions.map((item) => (
                <option key={item.action} value={item.action}>
                  {item.action.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <Button type="submit">Apply</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/activity">Clear</Link>
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Record</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Occurred</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No activity found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{entry.action.replaceAll("_", " ")}</TableCell>
                    <TableCell className="text-xs">
                      <span>{entry.entityLabel ?? entry.entityId}</span>
                      <span className="block text-muted-foreground">{entry.entityType}</span>
                    </TableCell>
                    <TableCell className="text-xs">{entry.actorName ?? "System"}</TableCell>
                    <TableCell className="text-xs">{formatDateTime(entry.occurredAt)}</TableCell>
                    <TableCell className="text-xs">
                      {entry.details ? (
                        <details className="cursor-pointer">
                          <summary className="text-muted-foreground">View</summary>
                          <pre className="mt-1 max-w-xs overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-[10px]">
                            {JSON.stringify(entry.details, null, 2)}
                          </pre>
                        </details>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
            <span>Page {query.page} of {totalPages}</span>
            <div className="flex gap-2">
              {query.page > 1 ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={pageHref(raw, query.page - 1)}>
                    <ChevronLeft className="size-4" /> Previous
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  <ChevronLeft className="size-4" /> Previous
                </Button>
              )}
              {query.page < totalPages ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={pageHref(raw, query.page + 1)}>
                    Next <ChevronRight className="size-4" />
                  </Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  Next <ChevronRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

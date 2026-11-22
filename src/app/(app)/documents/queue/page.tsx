import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/features/documents/components/status-badge";
import { listProcessingQueue, type QueueView } from "@/features/documents/queries";
import { requirePermission } from "@/lib/auth/session";

interface QueuePageProps {
  searchParams: Promise<{ view?: string; mine?: string }>;
}

export const instant = false;

const VIEWS: Array<{ key: QueueView; label: string }> = [
  { key: "all", label: "All active" },
  { key: "encoding", label: "Awaiting encoding" },
  { key: "awaiting-decision", label: "Awaiting focal outcome" },
  { key: "returned", label: "Returned for correction" },
  { key: "approved", label: "Approved / signed" },
  { key: "ready", label: "Ready for transmittal" },
];

function parseView(value: string | undefined): QueueView {
  return VIEWS.some((item) => item.key === value) ? (value as QueueView) : "all";
}

function queueHref(view: QueueView, mine: boolean): string {
  const params = new URLSearchParams();
  if (view !== "all") params.set("view", view);
  if (mine) params.set("mine", "1");
  const query = params.toString();
  return query ? `/documents/queue?${query}` : "/documents/queue";
}

export default async function QueuePage({ searchParams }: QueuePageProps) {
  const session = await requirePermission("document:read");
  const { view: rawView, mine } = await searchParams;
  const view = parseView(rawView);
  const onlyMine = mine === "1";
  const rows = await listProcessingQueue(view, onlyMine ? session.user.id : undefined);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Processing Queue"
        description="Application-user work areas. Focal persons do not have inboxes or accounts."
        actions={
          <Button size="sm" variant={onlyMine ? "default" : "outline"} asChild>
            <Link href={queueHref(view, !onlyMine)}>
              {onlyMine ? "Showing: assigned to me" : "Show only assigned to me"}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <Button
            key={item.key}
            size="sm"
            variant={item.key === view ? "default" : "outline"}
            asChild
          >
            <Link href={queueHref(item.key, onlyMine)}>{item.label}</Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{VIEWS.find((item) => item.key === view)?.label}</CardTitle>
          <CardDescription>{rows.length} document(s) in this queue.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking no.</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Focal person</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    No documents in this queue.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs font-medium">{row.trackingNumber}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.title}</TableCell>
                    <TableCell className="text-xs">{row.dateReceived}</TableCell>
                    <TableCell className="text-xs">{row.assignedUserName ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.destinationOfficeName ?? "—"}</TableCell>
                    <TableCell className="text-xs">{row.focalPersonName ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.currentStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/documents/${row.id}`}>Process</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {onlyMine ? null : (
            <p className="mt-4 text-xs text-muted-foreground">
              <Badge variant="secondary">All users</Badge> Use “assigned to me” to narrow this to your own workload.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

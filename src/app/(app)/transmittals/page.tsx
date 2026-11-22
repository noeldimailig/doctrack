import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActiveFocalPersons, getActiveOffices } from "@/features/admin/queries";
import { createTransmittal, findEligibleDocuments } from "@/features/transmittals/actions";
import { TransmittalFormDialog } from "@/features/transmittals/components/transmittal-form-dialog";
import { TransmittalStatusBadge } from "@/features/transmittals/components/transmittal-status-badge";
import { listTransmittals } from "@/features/transmittals/queries";
import { transmittalListQuerySchema } from "@/features/transmittals/validation";
import { hasPermission, requirePermission } from "@/lib/auth/session";

interface TransmittalsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const instant = false;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(value);
}

export default async function TransmittalsPage({ searchParams }: TransmittalsPageProps) {
  await requirePermission("transmittal:read");
  const raw = await searchParams;
  const query = transmittalListQuerySchema.parse({
    q: first(raw.q),
    status: first(raw.status) || undefined,
  });

  const [transmittals, offices, focalPersons, eligibleDocuments, canCreate] = await Promise.all([
    listTransmittals(query),
    getActiveOffices(),
    getActiveFocalPersons(),
    findEligibleDocuments(),
    hasPermission("transmittal:create"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transmittals"
        description="Destination-specific transmittal reports, retained with historical snapshots."
        actions={
          canCreate ? (
            <TransmittalFormDialog
              action={createTransmittal}
              offices={offices}
              focalPersons={focalPersons}
              documents={eligibleDocuments}
            />
          ) : null
        }
      />

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Transmittal register</CardTitle>
            <CardDescription>{transmittals.length} transmittal(s) match the current filters.</CardDescription>
          </div>
          <form action="/transmittals" method="get" className="flex flex-wrap gap-2">
            <Input name="q" defaultValue={query.q} placeholder="Number or destination" className="max-w-xs" />
            <select name="status" defaultValue={query.status} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">All statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="FINALIZED">Finalized</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <Button type="submit">Apply</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/transmittals">Clear</Link>
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transmittal no.</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Documents</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prepared by</TableHead>
                <TableHead>Finalized</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transmittals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No transmittals found.
                  </TableCell>
                </TableRow>
              ) : (
                transmittals.map((transmittal) => (
                  <TableRow key={transmittal.id}>
                    <TableCell className="font-mono text-xs font-medium">{transmittal.transmittalNumber}</TableCell>
                    <TableCell>{transmittal.destinationName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{transmittal.documentCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <TransmittalStatusBadge status={transmittal.status} />
                    </TableCell>
                    <TableCell className="text-xs">{transmittal.preparedByName ?? "—"}</TableCell>
                    <TableCell className="text-xs">{formatDate(transmittal.finalizedAt)}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/transmittals/${transmittal.id}`}>View report</Link>
                      </Button>
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

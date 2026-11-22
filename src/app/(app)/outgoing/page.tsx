import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActiveFocalPersons, getActiveOffices } from "@/features/admin/queries";
import { createTransmittal, findEligibleDocuments } from "@/features/transmittals/actions";
import { TransmittalFormDialog } from "@/features/transmittals/components/transmittal-form-dialog";
import { hasPermission, requirePermission } from "@/lib/auth/session";

interface OutgoingPageProps {
  searchParams: Promise<{ officeId?: string }>;
}

export const instant = false;

export default async function OutgoingPage({ searchParams }: OutgoingPageProps) {
  await requirePermission("document:read");
  const { officeId = "" } = await searchParams;
  const [documents, offices, focalPersons, canCreate] = await Promise.all([
    findEligibleDocuments(officeId || undefined),
    getActiveOffices(),
    getActiveFocalPersons(),
    hasPermission("transmittal:create"),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outgoing Documents"
        description="Signed documents prepared for transmittal and not yet assigned to an active transmittal."
        actions={
          canCreate ? (
            <TransmittalFormDialog
              action={createTransmittal}
              offices={offices}
              focalPersons={focalPersons}
              documents={documents}
            />
          ) : null
        }
      />

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Ready for transmittal</CardTitle>
            <CardDescription>{documents.length} eligible document(s).</CardDescription>
          </div>
          <form action="/outgoing" method="get" className="flex flex-wrap gap-2">
            <select name="officeId" defaultValue={officeId} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">All destinations</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
            <Button type="submit">Apply</Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/outgoing">Clear</Link>
            </Button>
          </form>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking no.</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Focal person</TableHead>
                <TableHead>Outgoing date</TableHead>
                <TableHead>Outgoing reference</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No eligible documents. Approve a document and prepare it for outgoing processing first.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell className="font-mono text-xs font-medium">{document.trackingNumber}</TableCell>
                    <TableCell className="max-w-sm">
                      <Link href={`/documents/${document.id}`} className="font-medium hover:underline">
                        {document.title}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">{document.referenceNumber ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-xs">{document.destinationOfficeName}</TableCell>
                    <TableCell className="text-xs">{document.focalPersonName ?? "—"}</TableCell>
                    <TableCell className="text-xs">{document.outgoingDate ?? "—"}</TableCell>
                    <TableCell className="text-xs">{document.outgoingReferenceNumber ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" asChild>
                        <Link href={`/documents/${document.id}`}>View</Link>
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

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getApplicationUsers, getActiveOffices, getActiveFocalPersons } from "@/features/admin/queries";
import { createDocument, encodeDocument } from "@/features/documents/actions";
import { DocumentFormDialog } from "@/features/documents/components/document-form-dialog";
import { StatusBadge } from "@/features/documents/components/status-badge";
import { listDocuments } from "@/features/documents/queries";
import { DOCUMENT_STATUSES, STATUS_LABELS } from "@/features/documents/status";
import { documentListQuerySchema } from "@/features/documents/validation";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documentTypes } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

interface DocumentsPageProps {
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
  return `/documents?${params.toString()}`;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  await requirePermission("document:read");
  const raw = await searchParams;
  const query = documentListQuerySchema.parse({
    q: first(raw.q),
    status: first(raw.status),
    officeId: first(raw.officeId),
    focalPersonId: first(raw.focalPersonId),
    dateFrom: first(raw.dateFrom),
    dateTo: first(raw.dateTo),
    sort: first(raw.sort) || undefined,
    direction: first(raw.direction) || undefined,
    page: first(raw.page) || undefined,
    pageSize: first(raw.pageSize) || undefined,
  });

  const [{ rows, total }, offices, focalPersons, appUsers, types] = await Promise.all([
    listDocuments(query),
    getActiveOffices(),
    getActiveFocalPersons(),
    getApplicationUsers(),
    db.select({ id: documentTypes.id, name: documentTypes.name }).from(documentTypes).orderBy(asc(documentTypes.name)),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incoming Documents"
        description="Registration records and current administrative processing status."
        actions={
          <DocumentFormDialog
            action={createDocument}
            options={{ documentTypes: types, offices, focalPersons, applicationUsers: appUsers }}
          />
        }
      />

      <Card>
        <CardHeader className="gap-3">
          <div>
            <CardTitle>Document tracker</CardTitle>
            <CardDescription>{total} document(s) match the current filters.</CardDescription>
          </div>
          <form action="/documents" method="get" className="grid gap-2 md:grid-cols-6">
            <Input name="q" defaultValue={query.q} placeholder="Tracking no., title or reference" className="md:col-span-2" />
            <select name="status" defaultValue={query.status} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">All statuses</option>
              {DOCUMENT_STATUSES.map((status) => (
                <option key={status} value={status}>{STATUS_LABELS[status]}</option>
              ))}
            </select>
            <select name="officeId" defaultValue={query.officeId} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">All destinations</option>
              {offices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}
            </select>
            <select name="focalPersonId" defaultValue={query.focalPersonId} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">All focal persons</option>
              {focalPersons.map((person) => <option key={person.id} value={person.id}>{person.fullName}</option>)}
            </select>
            <div className="flex gap-2">
              <Input type="date" name="dateFrom" defaultValue={query.dateFrom} className="min-w-0" />
              <Input type="date" name="dateTo" defaultValue={query.dateTo} className="min-w-0" />
            </div>
            <div className="flex gap-2 md:col-span-6">
              <Button type="submit">Apply filters</Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/documents">Clear</Link>
              </Button>
            </div>
          </form>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tracking no.</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Received</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>Focal person</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground">
                    No documents found.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-mono text-xs font-medium">{doc.trackingNumber}</TableCell>
                    <TableCell className="max-w-xs">
                      <Link href={`/documents/${doc.id}`} className="font-medium hover:underline">{doc.title}</Link>
                      <span className="block truncate text-xs text-muted-foreground">{doc.referenceNumber ?? "—"}</span>
                    </TableCell>
                    <TableCell className="text-xs">{doc.dateReceived}</TableCell>
                    <TableCell className="text-xs">{doc.destinationOfficeName ?? "—"}</TableCell>
                    <TableCell className="text-xs">{doc.focalPersonName ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={doc.currentStatus} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/documents/${doc.id}`}>View</Link>
                        </Button>
                        {doc.currentStatus === "RECEIVED" ? (
                          <ConfirmActionButton
                            label="Encode"
                            title="Complete encoding?"
                            description="This records the authenticated user and time, and moves the document to Encoded."
                            action={encodeDocument.bind(null, doc.id)}
                          />
                        ) : null}
                      </div>
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
                  <Link href={pageHref(raw, query.page - 1)}><ChevronLeft className="size-4" /> Previous</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled><ChevronLeft className="size-4" /> Previous</Button>
              )}
              {query.page < totalPages ? (
                <Button size="sm" variant="outline" asChild>
                  <Link href={pageHref(raw, query.page + 1)}>Next <ChevronRight className="size-4" /></Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>Next <ChevronRight className="size-4" /></Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

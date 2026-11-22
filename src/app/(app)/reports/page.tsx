import { PageHeader } from "@/components/layout/page-header";
import { PrintButton } from "@/components/shared/print-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getActiveFocalPersons, getActiveOffices } from "@/features/admin/queries";
import { StatusBadge } from "@/features/documents/components/status-badge";
import { DOCUMENT_STATUSES, STATUS_LABELS } from "@/features/documents/status";
import {
  getActivityReportRows,
  getDocumentReportRows,
  getTransmittalReportRows,
} from "@/features/reports/queries";
import { REPORT_LABELS, REPORT_TYPES, reportQuerySchema } from "@/features/reports/validation";
import { TransmittalStatusBadge } from "@/features/transmittals/components/transmittal-status-badge";
import { requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documentTypes } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

interface ReportsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const instant = false;

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  await requirePermission("report:export");
  const raw = await searchParams;
  const query = reportQuerySchema.parse({
    type: first(raw.type) || undefined,
    q: first(raw.q),
    officeId: first(raw.officeId),
    focalPersonId: first(raw.focalPersonId),
    status: first(raw.status),
    documentTypeId: first(raw.documentTypeId),
    dateFrom: first(raw.dateFrom),
    dateTo: first(raw.dateTo),
  });

  const [offices, focalPersons, types] = await Promise.all([
    getActiveOffices(),
    getActiveFocalPersons(),
    db.select({ id: documentTypes.id, name: documentTypes.name }).from(documentTypes).orderBy(asc(documentTypes.name)),
  ]);

  const isTransmittal = query.type === "transmittal";
  const isActivity = query.type === "activity";
  const documentRows = isTransmittal || isActivity ? [] : await getDocumentReportRows(query);
  const transmittalRows = isTransmittal ? await getTransmittalReportRows(query) : [];
  const activityRows = isActivity ? await getActivityReportRows(query) : [];
  const total = documentRows.length + transmittalRows.length + activityRows.length;

  const filterSummary = [
    query.q ? `Search: ${query.q}` : null,
    query.dateFrom ? `From: ${query.dateFrom}` : null,
    query.dateTo ? `To: ${query.dateTo}` : null,
    query.officeId ? `Office: ${offices.find((office) => office.id === query.officeId)?.name ?? query.officeId}` : null,
    query.focalPersonId
      ? `Focal person: ${focalPersons.find((person) => person.id === query.focalPersonId)?.fullName ?? query.focalPersonId}`
      : null,
    query.status ? `Status: ${query.status.replaceAll("_", " ")}` : null,
    query.documentTypeId
      ? `Type: ${types.find((type) => type.id === query.documentTypeId)?.name ?? query.documentTypeId}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <PageHeader
          title="Reports"
          description="Printable administrative reports built from recorded application data."
          actions={<PrintButton />}
        />
      </div>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Report parameters</CardTitle>
          <CardDescription>Filters are applied on the server before the report is rendered.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action="/reports" method="get" className="grid gap-3 md:grid-cols-4">
            <select name="type" defaultValue={query.type} className="h-9 rounded-md border bg-background px-3 text-sm md:col-span-2">
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {REPORT_LABELS[type]}
                </option>
              ))}
            </select>
            <Input name="q" defaultValue={query.q} placeholder="Search records" />
            <select name="officeId" defaultValue={query.officeId} className="h-9 rounded-md border bg-background px-3 text-sm">
              <option value="">All destinations</option>
              {offices.map((office) => (
                <option key={office.id} value={office.id}>
                  {office.name}
                </option>
              ))}
            </select>
            {!isTransmittal && !isActivity ? (
              <>
                <select
                  name="focalPersonId"
                  defaultValue={query.focalPersonId}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">All focal persons</option>
                  {focalPersons.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.fullName}
                    </option>
                  ))}
                </select>
                <select
                  name="status"
                  defaultValue={query.status}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">All statuses</option>
                  {DOCUMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
                <select
                  name="documentTypeId"
                  defaultValue={query.documentTypeId}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">All document types</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </>
            ) : null}
            <Input type="date" name="dateFrom" defaultValue={query.dateFrom} />
            <Input type="date" name="dateTo" defaultValue={query.dateTo} />
            <div className="flex gap-2 md:col-span-4">
              <Button type="submit">Generate report</Button>
              <Button type="button" variant="outline" asChild>
                <a href="/reports">Clear</a>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-5 p-6 print:p-0">
          <div className="border-b pb-4 text-center print:border-black">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground print:text-black">
              Document Tracking and Transmittal Management
            </p>
            <h3 className="mt-2 text-xl font-bold tracking-tight print:text-black">
              {REPORT_LABELS[query.type]}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground print:text-black">
              Generated {formatDateTime(new Date())}
            </p>
          </div>

          {filterSummary.length > 0 ? (
            <p className="text-xs text-muted-foreground print:text-black">{filterSummary.join(" · ")}</p>
          ) : null}

          {!isTransmittal && !isActivity ? (
            <Table className="print:text-black">
              <TableHeader>
                <TableRow className="print:border-black">
                  <TableHead>Tracking no.</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Focal person</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Transmittal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documentRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground print:text-black">
                      No records match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  documentRows.map((row) => (
                    <TableRow key={row.trackingNumber} className="print:border-black">
                      <TableCell className="font-mono text-xs font-medium">{row.trackingNumber}</TableCell>
                      <TableCell className="text-xs">{row.referenceNumber ?? "—"}</TableCell>
                      <TableCell className="text-xs">{row.title}</TableCell>
                      <TableCell className="text-xs">{row.dateReceived}</TableCell>
                      <TableCell className="text-xs">{row.destination ?? "—"}</TableCell>
                      <TableCell className="text-xs">{row.focalPerson ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.transmittalNumber ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : null}

          {isTransmittal ? (
            <Table className="print:text-black">
              <TableHeader>
                <TableRow className="print:border-black">
                  <TableHead>Transmittal no.</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Signatory</TableHead>
                  <TableHead>Prepared by</TableHead>
                  <TableHead>Prepared at</TableHead>
                  <TableHead>Finalized at</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transmittalRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground print:text-black">
                      No transmittals match the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  transmittalRows.map((row) => (
                    <TableRow key={row.transmittalNumber} className="print:border-black">
                      <TableCell className="font-mono text-xs font-medium">{row.transmittalNumber}</TableCell>
                      <TableCell className="text-xs">{row.destination}</TableCell>
                      <TableCell className="text-xs">{row.signatory ?? "—"}</TableCell>
                      <TableCell className="text-xs">{row.preparedBy ?? "—"}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(row.preparedAt)}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(row.finalizedAt)}</TableCell>
                      <TableCell>
                        <TransmittalStatusBadge status={row.status} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : null}

          {isActivity ? (
            <Table className="print:text-black">
              <TableHeader>
                <TableRow className="print:border-black">
                  <TableHead>Action</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Occurred</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activityRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground print:text-black">
                      No activity matches the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  activityRows.map((row) => (
                    <TableRow key={row.action + row.occurredAt.toISOString()} className="print:border-black">
                      <TableCell className="text-xs font-medium">{row.action.replaceAll("_", " ")}</TableCell>
                      <TableCell className="text-xs">
                        {row.entityLabel ?? row.entityType}
                        <span className="block text-muted-foreground print:text-black">{row.entityType}</span>
                      </TableCell>
                      <TableCell className="text-xs">{row.actorName ?? "System"}</TableCell>
                      <TableCell className="text-xs">{formatDateTime(row.occurredAt)}</TableCell>
                      <TableCell className="max-w-xs truncate text-[10px]">
                        {row.details ? JSON.stringify(row.details) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : null}

          <div className="flex justify-between border-t pt-3 text-sm font-semibold print:border-black print:text-black">
            <span>Total records</span>
            <span>{total}</span>
          </div>

          <section className="grid gap-10 pt-8 sm:grid-cols-2">
            <div className="border-t pt-2 text-xs print:border-black">
              <p className="font-medium print:text-black">Prepared by</p>
              <p className="mt-6 text-muted-foreground print:text-black">Name / signature / date</p>
            </div>
            <div className="border-t pt-2 text-xs print:border-black">
              <p className="font-medium print:text-black">Reviewed by</p>
              <p className="mt-6 text-muted-foreground print:text-black">Name / signature / date</p>
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}

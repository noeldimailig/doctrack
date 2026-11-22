import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { PrintButton } from "@/components/shared/print-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cancelTransmittal, finalizeTransmittal } from "@/features/transmittals/actions";
import { CancelTransmittalDialog } from "@/features/transmittals/components/cancel-transmittal-dialog";
import { TransmittalStatusBadge } from "@/features/transmittals/components/transmittal-status-badge";
import { getTransmittalActivity, getTransmittalDetail, getTransmittalItems } from "@/features/transmittals/queries";
import { hasPermission, requirePermission } from "@/lib/auth/session";

interface TransmittalDetailPageProps {
  params: Promise<{ id: string }>;
}

export const instant = false;

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}

function ReportField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-black">{label}</p>
      <p className="text-sm font-medium print:text-black">{value ?? "—"}</p>
    </div>
  );
}

export default async function TransmittalDetailPage({ params }: TransmittalDetailPageProps) {
  await requirePermission("transmittal:read");
  const { id } = await params;
  const detail = await getTransmittalDetail(id);
  if (!detail) notFound();

  const [items, activity, canFinalize] = await Promise.all([
    getTransmittalItems(id),
    getTransmittalActivity(id),
    hasPermission("transmittal:finalize"),
  ]);

  const transmittal = detail.transmittal;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/transmittals">
            <ArrowLeft className="size-4" />
            Back to transmittals
          </Link>
        </Button>
      </div>

      <div className="print:hidden">
        <PageHeader
          title={transmittal.transmittalNumber}
          description={`Transmittal report for ${transmittal.destinationNameSnapshot}`}
          actions={
            <>
              <TransmittalStatusBadge status={transmittal.status} />
              <PrintButton />
              {transmittal.status === "DRAFT" && canFinalize ? (
                <>
                  <ConfirmActionButton
                    label="Finalize transmittal"
                    title="Finalize this transmittal?"
                    description="Finalization locks the document list, snapshots the report, and marks every included document as transmitted. This cannot be undone."
                    action={finalizeTransmittal.bind(null, id)}
                    variant="default"
                    confirmLabel="Finalize"
                  />
                  <CancelTransmittalDialog action={cancelTransmittal.bind(null, id)} />
                </>
              ) : null}
            </>
          }
        />
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-6 p-6 print:p-0">
          <div className="border-b pb-4 text-center print:border-black">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground print:text-black">
              Document Tracking and Transmittal Management
            </p>
            <h3 className="mt-2 text-xl font-bold tracking-tight print:text-black">TRANSMITTAL REPORT</h3>
            <p className="mt-1 font-mono text-sm font-semibold print:text-black">{transmittal.transmittalNumber}</p>
            {transmittal.status !== "FINALIZED" ? (
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-destructive print:text-black">
                {transmittal.status === "DRAFT" ? "Draft — not finalized" : "Cancelled"}
              </p>
            ) : null}
          </div>

          <section className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportField label="Destination" value={transmittal.destinationNameSnapshot} />
            <ReportField label="Signatory" value={transmittal.signatoryNameSnapshot} />
            <ReportField label="Prepared by" value={detail.preparedByName} />
            <ReportField label="Prepared at" value={formatDateTime(transmittal.preparedAt)} />
            <ReportField label="Finalized by" value={detail.finalizedByName} />
            <ReportField label="Finalized at" value={formatDateTime(transmittal.finalizedAt)} />
            <ReportField label="Status" value={<TransmittalStatusBadge status={transmittal.status} />} />
            <ReportField label="Document count" value={items.length} />
          </section>

          {transmittal.remarks ? (
            <section className="rounded-md border p-3 print:border-black">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground print:text-black">Remarks</p>
              <p className="mt-1 text-sm print:text-black">{transmittal.remarks}</p>
            </section>
          ) : null}

          {transmittal.cancellationReason ? (
            <section className="rounded-md border border-destructive p-3 print:border-black">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-destructive print:text-black">
                Cancellation reason
              </p>
              <p className="mt-1 text-sm print:text-black">{transmittal.cancellationReason}</p>
            </section>
          ) : null}

          <Table className="print:text-black">
            <TableHeader>
              <TableRow className="print:border-black">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Tracking no.</TableHead>
                <TableHead>Reference no.</TableHead>
                <TableHead>Title / subject</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground print:text-black">
                    This transmittal has no items.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item, index) => (
                  <TableRow key={item.id} className="print:border-black">
                    <TableCell className="text-xs">{index + 1}</TableCell>
                    <TableCell className="font-mono text-xs font-medium">{item.trackingNumber}</TableCell>
                    <TableCell className="text-xs">{item.referenceNumber ?? "—"}</TableCell>
                    <TableCell className="text-xs">{item.title}</TableCell>
                    <TableCell className="text-xs">{item.documentType ?? "—"}</TableCell>
                    <TableCell className="text-xs">{item.documentDate ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <p className="text-[10px] text-muted-foreground print:text-black">
            Values on this report are snapshots taken when the transmittal was created and finalized. Later edits to a
            document do not change a historical transmittal.
          </p>

          <section className="grid gap-10 pt-8 sm:grid-cols-3">
            <div className="border-t pt-2 text-xs print:border-black">
              <p className="font-medium print:text-black">Prepared by</p>
              <p className="mt-6 text-muted-foreground print:text-black">{detail.preparedByName ?? "—"}</p>
            </div>
            <div className="border-t pt-2 text-xs print:border-black">
              <p className="font-medium print:text-black">Received by</p>
              <p className="mt-6 text-muted-foreground print:text-black">Signature / date</p>
            </div>
            <div className="border-t pt-2 text-xs print:border-black">
              <p className="font-medium print:text-black">Destination signatory</p>
              <p className="mt-6 text-muted-foreground print:text-black">{transmittal.signatoryNameSnapshot ?? "Signature / date"}</p>
            </div>
          </section>
        </CardContent>
      </Card>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle>Transmittal activity</CardTitle>
          <CardDescription>Audit events for this transmittal record.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded.</p>
          ) : (
            activity.map((entry) => (
              <div key={entry.id} className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0">
                <div>
                  <p className="font-medium">{entry.action.replaceAll("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">{entry.actorName ?? "System"}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.occurredAt)}</time>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

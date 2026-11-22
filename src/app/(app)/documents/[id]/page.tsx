import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getApplicationUsers, getActiveFocalPersons, getActiveOffices } from "@/features/admin/queries";
import { cancelDocument, updateDocument } from "@/features/documents/actions";
import { DocumentFormDialog, type DocumentFormValues } from "@/features/documents/components/document-form-dialog";
import { StatusBadge } from "@/features/documents/components/status-badge";
import {
  getCorrectiveActions,
  getDocumentActivity,
  getDocumentAssignments,
  getDocumentDetail,
  getDocumentForwardings,
  getDocumentReviews,
  getDocumentReturns,
  getDocumentStatusHistory,
  getDocumentTransmittal,
} from "@/features/documents/queries";
import { isTerminal } from "@/features/documents/status";
import { prepareOutgoing } from "@/features/transmittals/actions";
import {
  CancelDocumentDialog,
  CorrectiveActionDialog,
  ForwardDocumentDialog,
  ReadyForTransmittalDialog,
  RecordDecisionDialog,
} from "@/features/workflow/components/workflow-dialogs";
import { forwardDocument, recordCorrectiveAction, recordReviewDecision } from "@/features/workflow/actions";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { documentTypes } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

interface DocumentDetailsPageProps {
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="text-sm">{value ?? "—"}</div>
    </div>
  );
}

export default async function DocumentDetailsPage({ params }: DocumentDetailsPageProps) {
  await requirePermission("document:read");
  const { id } = await params;
  const detail = await getDocumentDetail(id);
  if (!detail) notFound();

  const session = await requirePermission("document:read");
  const [history, assignments, forwardings, reviews, returns, corrections, transmittal, activity, offices, focalPersons, appUsers, types] =
    await Promise.all([
      getDocumentStatusHistory(id),
      getDocumentAssignments(id),
      getDocumentForwardings(id),
      getDocumentReviews(id),
      getDocumentReturns(id),
      getCorrectiveActions(id),
      getDocumentTransmittal(id),
      getDocumentActivity(id),
      getActiveOffices(),
      getActiveFocalPersons(),
      getApplicationUsers(),
      db.select({ id: documentTypes.id, name: documentTypes.name }).from(documentTypes).orderBy(asc(documentTypes.name)),
    ]);

  const doc = detail.document;
  const canUpdate = await hasPermission("document:update");
  const canForward = await hasPermission("document:forward");
  const canRecordDecision = await hasPermission("document:record-decision");
  const canCorrect = await hasPermission("document:correct");
  const canCancel = await hasPermission("document:cancel");
  const canTransmit = await hasPermission("transmittal:create");

  const formValues: DocumentFormValues = {
    id: doc.id,
    referenceNumber: doc.referenceNumber,
    title: doc.title,
    documentTypeId: doc.documentTypeId,
    documentDate: doc.documentDate,
    dateReceived: doc.dateReceived,
    senderOfficeId: doc.senderOfficeId,
    senderName: doc.senderName,
    senderReference: doc.senderReference,
    assignedUserId: doc.assignedUserId ?? "",
    destinationOfficeId: doc.destinationOfficeId ?? "",
    intendedFocalPersonId: doc.intendedFocalPersonId ?? "",
    remarks: doc.remarks,
  };
  const dialogProps = {
    focalPersons,
    applicationUsers: appUsers.map((appUser) => ({ id: appUser.id, name: appUser.name })),
    currentFocalPersonId: doc.intendedFocalPersonId,
    currentUserId: session.user.id,
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/documents"><ArrowLeft className="size-4" /> Back to tracker</Link>
      </Button>

      <PageHeader
        title={doc.title}
        description={`Tracking number ${doc.trackingNumber}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={doc.currentStatus} />
            {canUpdate && ["RECEIVED", "ENCODED", "RETURNED_FOR_CORRECTION"].includes(doc.currentStatus) ? (
              <DocumentFormDialog
                action={updateDocument.bind(null, doc.id)}
                options={{ documentTypes: types, offices, focalPersons, applicationUsers: appUsers }}
                initialValues={formValues}
              />
            ) : null}
            {canForward && ["ENCODED", "RETURNED_FOR_CORRECTION"].includes(doc.currentStatus) ? (
              <ForwardDocumentDialog action={forwardDocument.bind(null, doc.id)} {...dialogProps} />
            ) : null}
            {canRecordDecision && doc.currentStatus === "FORWARDED_TO_FOCAL_PERSON" ? (
              <RecordDecisionDialog action={recordReviewDecision.bind(null, doc.id)} {...dialogProps} />
            ) : null}
            {canCorrect && doc.currentStatus === "RETURNED_FOR_CORRECTION" ? (
              <CorrectiveActionDialog action={recordCorrectiveAction.bind(null, doc.id)} />
            ) : null}
            {canTransmit && doc.currentStatus === "APPROVED" ? (
              <ReadyForTransmittalDialog
                action={prepareOutgoing.bind(null, doc.id)}
                hasOutgoingData={Boolean(doc.outgoingDate || doc.outgoingReferenceNumber)}
              />
            ) : null}
            {canCancel && !isTerminal(doc.currentStatus) ? (
              <CancelDocumentDialog action={cancelDocument.bind(null, doc.id)} />
            ) : null}
          </div>
        }
      />

      <Tabs defaultValue="overview">
        <TabsList className="flex w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reviews">Reviews & corrections</TabsTrigger>
          <TabsTrigger value="history">Status history</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Document information</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Tracking number" value={<span className="font-mono font-medium">{doc.trackingNumber}</span>} />
                <Field label="Reference number" value={doc.referenceNumber} />
                <Field label="Document type" value={detail.documentTypeName} />
                <Field label="Document date" value={doc.documentDate} />
                <Field label="Date received" value={doc.dateReceived} />
                <Field label="Encoded at" value={formatDateTime(doc.encodedAt)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Sender information</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Sender office" value={detail.senderOfficeName} />
                <Field label="Sender name" value={doc.senderName} />
                <Field label="Sender reference" value={doc.senderReference} />
                <Field label="Remarks" value={doc.remarks} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Receiving & assignment</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Assigned personnel" value={detail.assignedUserName} />
                <Field label="Encoded by" value={detail.encodedByUserName} />
                <Field label="Destination office" value={detail.destinationOfficeName} />
                <Field label="Intended focal person" value={`${detail.focalPersonName ?? "—"}${detail.focalPersonPosition ? ` (${detail.focalPersonPosition})` : ""}`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Outgoing & transmittal</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <Field label="Outgoing date" value={doc.outgoingDate} />
                <Field label="Outgoing reference" value={doc.outgoingReferenceNumber} />
                <Field label="Ready at" value={formatDateTime(doc.readyForTransmittalAt)} />
                <Field label="Prepared by" value={detail.readyByUserName} />
                <Field label="Transmittal" value={transmittal ? <Link className="text-primary hover:underline" href={`/transmittals/${transmittal.transmittalId}`}>{transmittal.transmittalNumber}</Link> : null} />
                <Field label="Transmittal status" value={transmittal?.status ?? "—"} />
              </CardContent>
            </Card>
          </div>
          {doc.cancellationReason ? (
            <Card className="border-destructive">
              <CardHeader><CardTitle className="text-destructive">Cancelled</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm">{doc.cancellationReason}</p>
                <p className="mt-1 text-xs text-muted-foreground">Cancelled at {formatDateTime(doc.cancelledAt)}</p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Focal person decisions</CardTitle><CardDescription>Each row distinguishes the physical reviewer from the application user who recorded the result.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {reviews.length === 0 ? <p className="text-sm text-muted-foreground">No decision recorded yet.</p> : reviews.map((review) => (
                <div key={review.id} className="rounded-md border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge variant={review.decision === "APPROVED" ? "default" : "secondary"}>{review.decision.replaceAll("_", " ")}</Badge>
                    <span className="text-xs text-muted-foreground">Recorded {formatDateTime(review.recordedAt)}</span>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <p><span className="text-muted-foreground">Reviewer:</span> {review.focalPersonName}</p>
                    <p><span className="text-muted-foreground">Recorded by:</span> {review.recordedByName}</p>
                    <p><span className="text-muted-foreground">Decision date:</span> {review.decisionDate ?? "—"}</p>
                    <p><span className="text-muted-foreground">Returned at:</span> {formatDateTime(review.returnedToReceivingAt)}</p>
                  </div>
                  {review.remarks ? <p className="mt-2 text-xs">{review.remarks}</p> : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle>Forwardings</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {forwardings.length === 0 ? <p className="text-muted-foreground">None yet.</p> : forwardings.map((item) => (
                  <div key={item.id} className="rounded border p-2">
                    <p className="font-medium">Cycle {item.cycleNumber} — {item.focalPersonName}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.forwardedAt)} by {item.forwardedByName}</p>
                    {item.remarks ? <p className="mt-1 text-xs">{item.remarks}</p> : null}
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Returns</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {returns.length === 0 ? <p className="text-muted-foreground">None.</p> : returns.map((item) => (
                  <div key={item.id} className="rounded border p-2">
                    <p>{item.returnRemarks}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Acknowledged {formatDateTime(item.receivedAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Corrective actions</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {corrections.length === 0 ? <p className="text-muted-foreground">None.</p> : corrections.map((item) => (
                  <div key={item.id} className="rounded border p-2">
                    <p>{item.actionTaken}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.correctedAt)} — {item.recordedByName}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Assignments</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {assignments.length === 0 ? <p className="text-muted-foreground">None.</p> : assignments.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded border p-2">
                  <span>Cycle {item.cycleNumber}: {item.focalPersonName} by {item.assignedByName}</span>
                  {item.isCurrent ? <Badge variant="secondary">Current</Badge> : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader><CardTitle>Status history</CardTitle><CardDescription>Append-only audit trail of every controlled transition.</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {history.length === 0 ? <p className="text-sm text-muted-foreground">No status history.</p> : history.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1 text-sm">
                    <p className="font-medium">{item.fromStatus ?? "New"} → {item.toStatus}</p>
                    <p className="text-xs text-muted-foreground">{item.action.replaceAll("_", " ")} · {item.changedByName ?? "System"} · {formatDateTime(item.createdAt)}</p>
                    {item.reason ? <p className="mt-1 text-xs">{item.reason}</p> : null}
                  </div>
                  <Separator className="hidden" />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader><CardTitle>Activity log</CardTitle><CardDescription>Immutable events recorded by server-side actions.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity recorded.</p> : activity.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 border-b pb-2 text-sm last:border-0">
                  <div>
                    <p className="font-medium">{item.action.replaceAll("_", " ")}</p>
                    <p className="text-xs text-muted-foreground">{item.actorName ?? "System"} · {item.entityType}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(item.occurredAt)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

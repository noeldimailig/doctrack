import Link from "next/link";
import { count, desc, eq, gte, sql } from "drizzle-orm";
import { ArrowRight, Building2, FileText, Send, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission, requirePermission } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { activityLogs, documents, focalPersons, offices, transmittals, user } from "@/lib/db/schema";
import { STATUS_LABELS, type DocumentStatus } from "@/features/documents/status";

export const instant = false;

function manilaDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(value);
}

export default async function DashboardPage() {
  await requirePermission("document:read");
  const now = new Date();
  const sevenDaysAgoDate = new Date(now);
  sevenDaysAgoDate.setDate(now.getDate() - 7);
  const today = manilaDate(now);
  const sevenDaysAgo = manilaDate(sevenDaysAgoDate);
  const sevenDaysAgoInstant = sevenDaysAgoDate;

  const [
    documentCountResult,
    todayCountResult,
    officeCountResult,
    focalCountResult,
    transmittalCountResult,
    statusCounts,
    recentDocuments,
    incomingTrend,
    outgoingTrend,
    canReadActivity,
    canUpdate,
    canForward,
    canRecordDecision,
    canCorrect,
    canCreateTransmittal,
  ] = await Promise.all([
    db.select({ value: count() }).from(documents),
    db.select({ value: count() }).from(documents).where(gte(documents.dateReceived, today)),
    db.select({ value: count() }).from(offices),
    db.select({ value: count() }).from(focalPersons),
    db.select({ value: count() }).from(transmittals),
    db.select({ status: documents.currentStatus, value: count() }).from(documents).groupBy(documents.currentStatus),
    db
      .select({
        id: documents.id,
        trackingNumber: documents.trackingNumber,
        title: documents.title,
        status: documents.currentStatus,
        dateReceived: documents.dateReceived,
      })
      .from(documents)
      .orderBy(desc(documents.createdAt))
      .limit(5),
    db
      .select({ date: documents.dateReceived, value: count() })
      .from(documents)
      .where(gte(documents.dateReceived, sevenDaysAgo))
      .groupBy(documents.dateReceived)
      .orderBy(documents.dateReceived),
    db
      .select({ date: sql<string>`to_char(${documents.readyForTransmittalAt}, 'YYYY-MM-DD')`, value: count() })
      .from(documents)
      .where(gte(documents.readyForTransmittalAt, sevenDaysAgoInstant))
      .groupBy(sql`to_char(${documents.readyForTransmittalAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${documents.readyForTransmittalAt}, 'YYYY-MM-DD')`),
    hasPermission("activity:read"),
    hasPermission("document:update"),
    hasPermission("document:forward"),
    hasPermission("document:record-decision"),
    hasPermission("document:correct"),
    hasPermission("transmittal:create"),
  ]);

  const statusMap = new Map(statusCounts.map((row) => [row.status, row.value]));
  const value = (status: DocumentStatus) => statusMap.get(status) ?? 0;
  const outgoingTotal = value("READY_FOR_TRANSMITTAL") + value("TRANSMITTED");

  const stats = [
    { label: "Total incoming documents", value: documentCountResult[0]?.value ?? 0, icon: FileText },
    { label: "Received today", value: todayCountResult[0]?.value ?? 0, icon: FileText },
    { label: "Outgoing documents", value: outgoingTotal, icon: Send },
    { label: "Transmittals", value: transmittalCountResult[0]?.value ?? 0, icon: Send },
    { label: "Offices", value: officeCountResult[0]?.value ?? 0, icon: Building2 },
    { label: "Focal persons", value: focalCountResult[0]?.value ?? 0, icon: Users },
  ];

  const pendingActions = [
    {
      label: "Awaiting encoding",
      count: value("RECEIVED"),
      href: "/documents/queue?view=encoding",
      allowed: canUpdate,
    },
    {
      label: "Ready to forward",
      count: value("ENCODED"),
      href: "/documents/queue?view=all",
      allowed: canForward,
    },
    {
      label: "Awaiting focal outcome",
      count: value("FORWARDED_TO_FOCAL_PERSON"),
      href: "/documents/queue?view=awaiting-decision",
      allowed: canRecordDecision,
    },
    {
      label: "Returned for correction",
      count: value("RETURNED_FOR_CORRECTION"),
      href: "/documents/queue?view=returned",
      allowed: canCorrect,
    },
    {
      label: "Approved / signed",
      count: value("APPROVED"),
      href: "/documents/queue?view=approved",
      allowed: canCreateTransmittal,
    },
    {
      label: "Ready for transmittal",
      count: value("READY_FOR_TRANSMITTAL"),
      href: "/outgoing",
      allowed: canCreateTransmittal,
    },
  ].filter((item) => item.allowed);

  const recentActivity = canReadActivity
    ? await db
        .select({
          id: activityLogs.id,
          action: activityLogs.action,
          entityLabel: activityLogs.entityLabel,
          entityType: activityLogs.entityType,
          occurredAt: activityLogs.occurredAt,
          actorName: user.name,
        })
        .from(activityLogs)
        .leftJoin(user, eq(activityLogs.actorUserId, user.id))
        .orderBy(desc(activityLogs.occurredAt))
        .limit(5)
    : [];

  const maxTrend = Math.max(1, ...incomingTrend.map((row) => row.value), ...outgoingTrend.map((row) => row.value));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Operations Overview</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Live counts from the document tracker, processing queues and transmittal register.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{stat.label}</CardTitle>
              <stat.icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending actions</CardTitle>
            <CardDescription>Only queues permitted for your account are shown.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingActions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending-action queues are available to your account.</p>
            ) : (
              pendingActions.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span>{item.label}</span>
                  <span className="flex items-center gap-2">
                    <Badge variant="secondary">{item.count}</Badge>
                    <ArrowRight className="size-3 text-muted-foreground" />
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Document status distribution</CardTitle>
            <CardDescription>Current state of all tracked documents.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {statusCounts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents have been registered yet.</p>
            ) : (
              statusCounts.map((row) => (
                <div key={row.status} className="flex items-center justify-between text-sm">
                  <span>{STATUS_LABELS[row.status as DocumentStatus] ?? row.status}</span>
                  <Badge variant="secondary">{row.value}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incoming trend</CardTitle>
            <CardDescription>Documents received during the last seven days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {incomingTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No incoming documents in this period.</p>
            ) : (
              incomingTrend.map((row) => (
                <div key={row.date} className="grid grid-cols-[80px_1fr_30px] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{row.date}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(row.value / maxTrend) * 100}%` }} />
                  </div>
                  <span className="text-right font-medium">{row.value}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outgoing trend</CardTitle>
            <CardDescription>Documents prepared for transmittal during the last seven days.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {outgoingTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground">No outgoing documents in this period.</p>
            ) : (
              outgoingTrend.map((row) => (
                <div key={row.date} className="grid grid-cols-[80px_1fr_30px] items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{row.date}</span>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(row.value / maxTrend) * 100}%` }} />
                  </div>
                  <span className="text-right font-medium">{row.value}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recently registered documents</CardTitle>
            <CardDescription>Most recent tracker entries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentDocuments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents registered yet.</p>
            ) : (
              recentDocuments.map((doc) => (
                <Link
                  key={doc.id}
                  href={`/documents/${doc.id}`}
                  className="flex items-start justify-between gap-3 rounded-md border p-2 text-sm hover:bg-accent"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{doc.title}</span>
                    <span className="block font-mono text-xs text-muted-foreground">{doc.trackingNumber}</span>
                  </span>
                  <Badge variant="secondary">{STATUS_LABELS[doc.status]}</Badge>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {canReadActivity ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Immutable audit log, most recent first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
              ) : (
                recentActivity.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium">{entry.action.replaceAll("_", " ")}</p>
                      <p className="text-xs text-muted-foreground">
                        {entry.entityLabel ?? entry.entityType} · {entry.actorName ?? "System"}
                      </p>
                    </div>
                    <time className="shrink-0 text-xs text-muted-foreground">{formatDateTime(entry.occurredAt)}</time>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}

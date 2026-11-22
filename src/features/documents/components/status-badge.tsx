import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type DocumentStatus } from "../status";

const STYLES: Record<DocumentStatus, string> = {
  RECEIVED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  ENCODED: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  FORWARDED_TO_FOCAL_PERSON: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200",
  RETURNED_FOR_CORRECTION: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  READY_FOR_TRANSMITTAL: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-200",
  TRANSMITTED: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
};

export function StatusBadge({ status }: { status: DocumentStatus }) {
  return <Badge className={`font-medium ${STYLES[status]}`}>{STATUS_LABELS[status] ?? status}</Badge>;
}

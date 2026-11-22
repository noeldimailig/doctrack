import { Badge } from "@/components/ui/badge";
import type { transmittals } from "@/lib/db/schema";

type Status = (typeof transmittals.status.enumValues)[number];

const LABELS: Record<Status, string> = {
  DRAFT: "Draft",
  FINALIZED: "Finalized",
  CANCELLED: "Cancelled",
};

const STYLES: Record<Status, string> = {
  DRAFT: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  FINALIZED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  CANCELLED: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
};

export function TransmittalStatusBadge({ status }: { status: Status }) {
  return <Badge className={`font-medium ${STYLES[status]}`}>{LABELS[status]}</Badge>;
}

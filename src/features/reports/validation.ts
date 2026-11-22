import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const optionalDateString = z.union([z.literal(""), dateString]);
const optionalUuid = z.union([z.literal(""), z.string().uuid()]);

export const REPORT_TYPES = [
  "incoming",
  "outgoing",
  "status",
  "returned",
  "awaiting-decision",
  "transmittal",
  "activity",
] as const;

export type ReportType = (typeof REPORT_TYPES)[number];

export const REPORT_LABELS: Record<ReportType, string> = {
  incoming: "Incoming Documents Report",
  outgoing: "Outgoing Documents Report",
  status: "Document Processing Status Report",
  returned: "Documents Returned for Correction",
  "awaiting-decision": "Documents Awaiting Focal Person Decision",
  transmittal: "Transmittal Report Register",
  activity: "Document Activity History",
};

export const reportQuerySchema = z.object({
  type: z.enum(REPORT_TYPES).optional().default("incoming"),
  q: z.string().trim().max(128).optional().default(""),
  officeId: optionalUuid.optional().default(""),
  focalPersonId: optionalUuid.optional().default(""),
  status: z.string().trim().optional().default(""),
  documentTypeId: optionalUuid.optional().default(""),
  dateFrom: optionalDateString.optional().default(""),
  dateTo: optionalDateString.optional().default(""),
});

export type ReportQuery = z.infer<typeof reportQuerySchema>;

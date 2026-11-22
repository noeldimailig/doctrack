import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const optionalDateString = z.union([z.literal(""), dateString]);
const optionalUuid = z.union([z.literal(""), z.string().uuid()]);
const optionalText = z.string().trim().max(2000).optional().or(z.literal(""));

export const createDocumentSchema = z.object({
  referenceNumber: z.string().trim().max(128).optional().or(z.literal("")),
  title: z.string().trim().min(3).max(2000),
  documentTypeId: z.string().uuid().nullable().optional(),
  documentDate: dateString.nullable().optional(),
  dateReceived: dateString,
  senderOfficeId: z.string().uuid().nullable().optional(),
  senderName: z.string().trim().max(255).optional().or(z.literal("")),
  senderReference: z.string().trim().max(128).optional().or(z.literal("")),
  assignedUserId: z.string().min(1),
  destinationOfficeId: z.string().uuid().min(1, "Select a destination office."),
  intendedFocalPersonId: z.string().uuid().min(1, "Select an intended focal person."),
  remarks: optionalText,
});

export const updateDocumentSchema = createDocumentSchema.omit({
  assignedUserId: true,
});

export const cancelDocumentSchema = z.object({
  reason: z.string().trim().min(5).max(2000),
});

export const documentListQuerySchema = z.object({
  q: z.string().trim().max(128).optional().default(""),
  status: z.string().trim().optional().default(""),
  officeId: optionalUuid.optional().default(""),
  focalPersonId: optionalUuid.optional().default(""),
  dateFrom: optionalDateString.optional().default(""),
  dateTo: optionalDateString.optional().default(""),
  sort: z.enum(["date_received", "tracking_number", "created_at", "title", "status"]).optional().default("date_received"),
  direction: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(20),
});

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;

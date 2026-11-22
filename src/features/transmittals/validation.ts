import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");

export const prepareOutgoingSchema = z.object({
  outgoingDate: dateString.optional().or(z.literal("")),
  outgoingReferenceNumber: z.string().trim().max(128).optional().or(z.literal("")),
  remarks: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const createTransmittalSchema = z.object({
  destinationOfficeId: z.string().uuid(),
  destinationSignatoryFocalPersonId: z.string().uuid().nullable().optional(),
  remarks: z.string().trim().max(2000).optional().or(z.literal("")),
  documentIds: z.array(z.string().uuid()).min(1, "Select at least one eligible document."),
});

export const transmittalListQuerySchema = z.object({
  q: z.string().trim().max(128).optional().default(""),
  status: z.enum(["", "DRAFT", "FINALIZED", "CANCELLED"]).optional().default(""),
});

import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.");
const dateTimeLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use a date and time.");

export const forwardDocumentSchema = z.object({
  focalPersonId: z.string().uuid(),
  forwardedAt: dateTimeLocal,
  remarks: z.string().trim().max(2000).optional().or(z.literal("")),
});

export const recordDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "RETURNED_FOR_CORRECTION"]),
    focalPersonId: z.string().uuid(),
    decisionDate: dateString.optional().or(z.literal("")),
    returnedToReceivingAt: dateTimeLocal.optional().or(z.literal("")),
    remarks: z.string().trim().max(2000).optional().or(z.literal("")),
    receivedByUserId: z.string().min(1).optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (value.decision === "RETURNED_FOR_CORRECTION" && !value.remarks?.trim()) {
      context.addIssue({
        code: "custom",
        path: ["remarks"],
        message: "Return remarks are required.",
      });
    }
  });

export const correctiveActionSchema = z.object({
  actionTaken: z.string().trim().min(5).max(2000),
  correctedAt: dateTimeLocal.optional().or(z.literal("")),
});

function parseDateTime(value: string | undefined | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export { parseDateTime };

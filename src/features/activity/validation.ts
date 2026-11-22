import { z } from "zod";

export const activityListQuerySchema = z.object({
  q: z.string().trim().max(128).optional().default(""),
  entityType: z.string().trim().max(64).optional().default(""),
  action: z.string().trim().max(64).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(20),
});

export type ActivityListQuery = z.infer<typeof activityListQuerySchema>;

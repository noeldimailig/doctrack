import { z } from "zod";

export const systemSettingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9_.-]+$/, "Use lowercase letters, numbers, dots, dashes or underscores."),
  value: z.string().min(1, "Enter a JSON value.").max(20_000),
});

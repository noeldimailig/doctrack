import { APIError, createAuthMiddleware } from "better-auth/api";
import { checkRateLimit } from "@/lib/security/rate-limit";

const LIMITED_PATHS = new Set(["/sign-in/email", "/admin/create-user", "/admin/set-user-password"]);
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;

/**
 * Better Auth before-hook for sensitive authentication endpoints. It uses the
 * Postgres-backed fixed-window limiter so all application instances share the
 * same counters. Public sign-up is disabled in `auth.ts`; accounts are created
 * only by administrators.
 */
export const authRateLimitHook = createAuthMiddleware(async (context) => {
  if (!LIMITED_PATHS.has(context.path)) return;

  const email =
    typeof context.body?.email === "string" ? context.body.email.trim().toLowerCase() : "unknown";
  const ip =
    context.getHeader("x-forwarded-for")?.split(",")[0]?.trim() ||
    context.getHeader("x-real-ip") ||
    "unknown";
  const key = `auth:${context.path}:${ip}:${email}`.slice(0, 255);

  const allowed = await checkRateLimit(key, MAX_ATTEMPTS, WINDOW_MS);
  if (!allowed) {
    throw APIError.fromStatus("TOO_MANY_REQUESTS", {
      message: "Too many attempts. Please try again later.",
    });
  }
});

import { headers } from "next/headers";
import { ForbiddenError, UnauthorizedError } from "@/lib/error/app-error";
import { auth } from "./auth";
import { getUserPermissionKeys, type PermissionKey } from "./permissions";

export type SessionData = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

/**
 * Always reads the database-backed session (bypasses the short-lived cookie cache)
 * so role changes and revocations take effect immediately.
 */
export async function getSession(): Promise<SessionData | null> {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
}

export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  return session;
}

export async function requirePermission(permission: PermissionKey): Promise<SessionData> {
  const session = await requireSession();
  const granted = await getUserPermissionKeys(session.user.id);
  if (!granted.includes(permission)) throw new ForbiddenError();
  return session;
}

export async function hasPermission(permission: PermissionKey): Promise<boolean> {
  const session = await getSession();
  if (!session?.user) return false;
  const granted = await getUserPermissionKeys(session.user.id);
  return granted.includes(permission);
}

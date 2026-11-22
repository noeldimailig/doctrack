import { cache } from "react";
import { headers } from "next/headers";
import { ForbiddenError, UnauthorizedError } from "@/lib/error/app-error";
import { auth } from "./auth";
import { getUserPermissionKeys, type PermissionKey } from "./permissions";

export type SessionData = NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;

export const getSession = cache(async (): Promise<SessionData | null> => {
  return auth.api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
});

const getCachedPermissions = cache(async (userId: string): Promise<PermissionKey[]> => {
  return getUserPermissionKeys(userId);
});

export async function requireSession(): Promise<SessionData> {
  const session = await getSession();
  if (!session?.user) throw new UnauthorizedError();
  return session;
}

export async function requirePermission(permission: PermissionKey): Promise<SessionData> {
  const session = await requireSession();
  const granted = await getCachedPermissions(session.user.id);
  if (!granted.includes(permission)) throw new ForbiddenError();
  return session;
}

export async function hasPermission(permission: PermissionKey): Promise<boolean> {
  const session = await getSession();
  if (!session?.user) return false;
  const granted = await getCachedPermissions(session.user.id);
  return granted.includes(permission);
}
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { admin, customSession } from "better-auth/plugins";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { authAccessControl, betterAuthRoles } from "./better-auth-roles";
import { getUserRoleKeys } from "./permissions";
import { authRateLimitHook } from "./rate-limit-hook";

function appUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.NODE_ENV === "production" && !configured) {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production. See docs/ENVIRONMENT.md.");
  }
  return configured ?? "http://localhost:3000";
}

export const auth = betterAuth({
  appName: "Document Tracking and Transmittal Management System",
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: [appUrl()],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    requireEmailVerification: false,
    disableSignUp: true,
  },
  hooks: {
    before: authRateLimitHook,
  },
  session: {
    expiresIn: 60 * 60 * 12,
    updateAge: 60 * 60,
    freshAge: 5 * 60,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },
  plugins: [
    admin({
      ac: authAccessControl,
      roles: betterAuthRoles,
      adminRoles: ["ADMIN"],
      defaultRole: "RECEIVING_PERSONNEL",
    }),
    customSession(async ({ user, session }) => ({
      session,
      user: {
        ...user,
        roleKeys: await getUserRoleKeys(user.id),
      },
    })),
    // Must be the last plugin.
    nextCookies(),
  ],
});

export type Auth = typeof auth;

"use client";

import { createAuthClient } from "better-auth/client";
import { adminClient } from "better-auth/client/plugins";
import { authAccessControl, betterAuthRoles } from "./better-auth-roles";

export const authClient = createAuthClient({
  plugins: [adminClient({ ac: authAccessControl, roles: betterAuthRoles })],
});

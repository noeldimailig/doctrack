import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { eq } from "drizzle-orm";
import { auth } from "../src/lib/auth/auth";
import { db } from "../src/lib/db";
import { activityLogs, roles, userRoles } from "../src/lib/db/schema";
import { ROLE_KEYS } from "../src/lib/auth/permissions";

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set before running admin:create.");
  }
  if (!email.includes("@")) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }

  const created = await auth.api.createUser({
    body: {
      email,
      password,
      name: "System Administrator",
      // Matches the configured Better Auth admin-plugin role key.
      role: ROLE_KEYS.ADMIN,
    },
  });

  const [adminRole] = await db.select().from(roles).where(eq(roles.key, ROLE_KEYS.ADMIN)).limit(1);
  if (!adminRole) {
    throw new Error("ADMIN role is missing. Run db:seed before creating the administrator.");
  }

  await db.insert(userRoles).values({ userId: created.user.id, roleId: adminRole.id }).onConflictDoNothing();
  await db.insert(activityLogs).values({
    actorUserId: created.user.id,
    action: "ADMIN_ACCOUNT_CREATED",
    entityType: "user",
    entityId: created.user.id,
    entityLabel: email,
    details: { method: "bootstrap-script" },
  });

  console.log(`Administrator created: ${email}`);
  console.log("Remove ADMIN_EMAIL and ADMIN_PASSWORD from your environment when setup is complete.");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("Administrator creation failed:", error);
  process.exit(1);
});

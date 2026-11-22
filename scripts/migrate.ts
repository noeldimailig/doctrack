import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../src/lib/db";

async function main(): Promise<void> {
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("Database migrations applied successfully.");
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

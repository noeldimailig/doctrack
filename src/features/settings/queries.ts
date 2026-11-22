import { asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { systemSettings } from "@/lib/db/schema";

export async function listSystemSettings() {
  return db.select().from(systemSettings).orderBy(asc(systemSettings.key));
}

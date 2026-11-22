import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

console.log("DATABASE_URL:", connectionString);

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured. See docs/ENVIRONMENT.md.");
}

const client = postgres(connectionString, {
  max: 10,
  ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : "require",
});

export const db = drizzle({ client, schema });
export type Database = typeof db;

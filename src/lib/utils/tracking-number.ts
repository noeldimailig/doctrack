import { sql } from "drizzle-orm";
import { db } from "@/lib/db";

/** Generates DCT-YYYY-NNNNNN using the database sequence and advisory lock. */
export async function nextTrackingNumber(year: number): Promise<string> {
  const result = await db.execute<{ next_document_number: string }>(
    sql`select public.next_document_number('DCT', ${year}) as next_document_number`,
  );
  return result[0].next_document_number;
}

/** Generates TRN-YYYY-NNNNNN using the same collision-safe mechanism. */
export async function nextTransmittalNumber(year: number): Promise<string> {
  const result = await db.execute<{ next_document_number: string }>(
    sql`select public.next_document_number('TRN', ${year}) as next_document_number`,
  );
  return result[0].next_document_number;
}

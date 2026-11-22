import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { documents } from "./documents";
import { focalPersons, offices } from "./organization";

export const transmittalStatusEnum = pgEnum("transmittal_status", ["DRAFT", "FINALIZED", "CANCELLED"]);

export const transmittals = pgTable(
  "transmittals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transmittalNumber: varchar("transmittal_number", { length: 32 }).notNull().unique(),
    status: transmittalStatusEnum("status").notNull().default("DRAFT"),

    destinationOfficeId: uuid("destination_office_id")
      .notNull()
      .references(() => offices.id, { onDelete: "restrict" }),
    destinationSignatoryFocalPersonId: uuid("destination_signatory_focal_person_id").references(
      () => focalPersons.id,
      { onDelete: "set null" },
    ),
    destinationNameSnapshot: varchar("destination_name_snapshot", { length: 255 }).notNull(),
    signatoryNameSnapshot: varchar("signatory_name_snapshot", { length: 255 }),

    preparedBy: text("prepared_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    preparedAt: timestamp("prepared_at", { withTimezone: true }).notNull().defaultNow(),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    finalizedBy: text("finalized_by").references(() => user.id, { onDelete: "set null" }),
    remarks: text("remarks"),
    cancellationReason: text("cancellation_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("transmittals_status_idx").on(table.status),
    index("transmittals_destination_idx").on(table.destinationOfficeId),
    check(
      "transmittals_cancellation_reason_check",
      sql`${table.status} <> 'CANCELLED' OR ${table.cancellationReason} IS NOT NULL`,
    ),
  ],
);

export const transmittalItems = pgTable(
  "transmittal_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    transmittalId: uuid("transmittal_id")
      .notNull()
      .references(() => transmittals.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "restrict" }),
    isFinalized: boolean("is_finalized").notNull().default(false),

    // Snapshots keep historical transmittals accurate if document edits occur later.
    trackingNumberSnapshot: varchar("tracking_number_snapshot", { length: 32 }).notNull(),
    referenceNumberSnapshot: varchar("reference_number_snapshot", { length: 128 }),
    titleSnapshot: text("title_snapshot").notNull(),
    documentTypeSnapshot: varchar("document_type_snapshot", { length: 120 }),
    documentDateSnapshot: date("document_date_snapshot"),
    remarksSnapshot: text("remarks_snapshot"),

    includedAt: timestamp("included_at", { withTimezone: true }).notNull().defaultNow(),
    includedBy: text("included_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
  },
  (table) => [
    uniqueIndex("transmittal_items_transmittal_document_uq").on(table.transmittalId, table.documentId),
    uniqueIndex("transmittal_items_one_finalized_per_document_uq")
      .on(table.documentId)
      .where(sql`${table.isFinalized} = true`),
  ],
);

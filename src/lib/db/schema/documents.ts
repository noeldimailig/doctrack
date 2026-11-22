import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { DOCUMENT_STATUSES, WORKFLOW_ACTIONS } from "../../../features/documents/status";
import { user } from "./auth";
import { documentTypes, focalPersons, offices } from "./organization";

export const documentStatusEnum = pgEnum("document_status", DOCUMENT_STATUSES);
export const workflowActionEnum = pgEnum("workflow_action", WORKFLOW_ACTIONS);
export const reviewDecisionEnum = pgEnum("review_decision", ["APPROVED", "RETURNED_FOR_CORRECTION"]);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    trackingNumber: varchar("tracking_number", { length: 32 }).notNull().unique(),
    referenceNumber: varchar("reference_number", { length: 128 }),
    title: text("title").notNull(),
    documentTypeId: uuid("document_type_id").references(() => documentTypes.id, { onDelete: "set null" }),
    documentDate: date("document_date"),
    dateReceived: date("date_received").notNull(),

    senderOfficeId: uuid("sender_office_id").references(() => offices.id, { onDelete: "set null" }),
    senderName: varchar("sender_name", { length: 255 }),
    senderReference: varchar("sender_reference", { length: 128 }),

    encodedAt: timestamp("encoded_at", { withTimezone: true }),
    encodedBy: text("encoded_by").references(() => user.id, { onDelete: "set null" }),
    assignedUserId: text("assigned_user_id").references(() => user.id, { onDelete: "set null" }),

    destinationOfficeId: uuid("destination_office_id").references(() => offices.id, { onDelete: "set null" }),
    intendedFocalPersonId: uuid("intended_focal_person_id").references(() => focalPersons.id, {
      onDelete: "set null",
    }),

    currentStatus: documentStatusEnum("current_status").notNull().default("RECEIVED"),
    remarks: text("remarks"),

    outgoingReferenceNumber: varchar("outgoing_reference_number", { length: 128 }),
    outgoingDate: date("outgoing_date"),
    outgoingRemarks: text("outgoing_remarks"),
    readyForTransmittalAt: timestamp("ready_for_transmittal_at", { withTimezone: true }),
    readyBy: text("ready_by").references(() => user.id, { onDelete: "set null" }),

    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: text("cancellation_reason"),

    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("documents_status_idx").on(table.currentStatus),
    index("documents_date_received_idx").on(table.dateReceived),
    index("documents_destination_office_idx").on(table.destinationOfficeId),
    index("documents_created_at_idx").on(table.createdAt),
    check(
      "documents_cancellation_reason_check",
      sql`${table.currentStatus} <> 'CANCELLED' OR ${table.cancellationReason} IS NOT NULL`,
    ),
  ],
);

export const documentAssignments = pgTable(
  "document_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    cycleNumber: integer("cycle_number").notNull(),
    focalPersonId: uuid("focal_person_id")
      .notNull()
      .references(() => focalPersons.id, { onDelete: "restrict" }),
    assignedBy: text("assigned_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
    isCurrent: boolean("is_current").notNull().default(false),
  },
  (table) => [
    uniqueIndex("document_assignments_cycle_uq").on(table.documentId, table.cycleNumber),
    index("document_assignments_focal_idx").on(table.focalPersonId),
  ],
);

export const documentForwardings = pgTable(
  "document_forwardings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    cycleNumber: integer("cycle_number").notNull(),
    focalPersonId: uuid("focal_person_id")
      .notNull()
      .references(() => focalPersons.id, { onDelete: "restrict" }),
    forwardedAt: timestamp("forwarded_at", { withTimezone: true }).notNull().defaultNow(),
    forwardedBy: text("forwarded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    remarks: text("remarks"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("document_forwardings_cycle_uq").on(table.documentId, table.cycleNumber)],
);

export const documentReviews = pgTable(
  "document_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    forwardingId: uuid("forwarding_id").references(() => documentForwardings.id, { onDelete: "set null" }),

    // The physical reviewer. Never an application user.
    focalPersonId: uuid("focal_person_id")
      .notNull()
      .references(() => focalPersons.id, { onDelete: "restrict" }),

    decision: reviewDecisionEnum("decision").notNull(),
    decisionDate: date("decision_date"),
    returnedToReceivingAt: timestamp("returned_to_receiving_at", { withTimezone: true }),
    remarks: text("remarks"),

    // The authenticated application user who entered the result.
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("document_reviews_document_idx").on(table.documentId)],
);

export const documentReturns = pgTable(
  "document_returns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    reviewId: uuid("review_id")
      .notNull()
      .unique()
      .references(() => documentReviews.id, { onDelete: "cascade" }),
    returnRemarks: text("return_remarks").notNull(),
    receivedByUserId: text("received_by_user_id").references(() => user.id, { onDelete: "set null" }),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("document_returns_document_idx").on(table.documentId)],
);

export const documentCorrectiveActions = pgTable(
  "document_corrective_actions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    returnId: uuid("return_id").references(() => documentReturns.id, { onDelete: "set null" }),
    actionTaken: text("action_taken").notNull(),
    correctedAt: timestamp("corrected_at", { withTimezone: true }),
    recordedBy: text("recorded_by")
      .notNull()
      .references(() => user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("corrective_actions_document_idx").on(table.documentId)],
);

export const documentStatusHistory = pgTable(
  "document_status_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    fromStatus: documentStatusEnum("from_status"),
    toStatus: documentStatusEnum("to_status").notNull(),
    action: workflowActionEnum("action").notNull(),
    changedBy: text("changed_by").references(() => user.id, { onDelete: "set null" }),
    reason: text("reason"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("status_history_document_idx").on(table.documentId, table.createdAt)],
);

export const documentStatusTransitions = pgTable(
  "document_status_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromStatus: documentStatusEnum("from_status"),
    action: workflowActionEnum("action").notNull(),
    toStatus: documentStatusEnum("to_status").notNull(),
  },
  (table) => [uniqueIndex("status_transitions_from_action_uq").on(table.fromStatus, table.action)],
);

/**
 * Central document status and workflow-action vocabulary.
 * The values must match the `document_status` and `workflow_action` Postgres
 * enums defined in the migrations.
 */

export const DOCUMENT_STATUSES = [
  "RECEIVED",
  "ENCODED",
  "FORWARDED_TO_FOCAL_PERSON",
  "RETURNED_FOR_CORRECTION",
  "APPROVED",
  "READY_FOR_TRANSMITTAL",
  "TRANSMITTED",
  "CANCELLED",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  RECEIVED: "Received",
  ENCODED: "Encoded",
  FORWARDED_TO_FOCAL_PERSON: "Forwarded to Focal Person",
  RETURNED_FOR_CORRECTION: "Returned for Correction",
  APPROVED: "Signed / Approved",
  READY_FOR_TRANSMITTAL: "Ready for Transmittal",
  TRANSMITTED: "Transmitted",
  CANCELLED: "Cancelled",
};

export const WORKFLOW_ACTIONS = [
  "REGISTER",
  "ENCODE",
  "FORWARD",
  "RECORD_APPROVAL",
  "RECORD_RETURN",
  "RECORD_CORRECTIVE_ACTION",
  "RE_FORWARD",
  "PREPARE_OUTGOING",
  "FINALIZE_TRANSMITTAL",
  "CANCEL",
] as const;

export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

export interface StatusTransition {
  action: WorkflowAction;
  from: DocumentStatus | null;
  to: DocumentStatus;
}

export const STATUS_TRANSITIONS: readonly StatusTransition[] = [
  { action: "REGISTER", from: null, to: "RECEIVED" },
  { action: "ENCODE", from: "RECEIVED", to: "ENCODED" },
  { action: "FORWARD", from: "ENCODED", to: "FORWARDED_TO_FOCAL_PERSON" },
  { action: "RECORD_APPROVAL", from: "FORWARDED_TO_FOCAL_PERSON", to: "APPROVED" },
  { action: "RECORD_RETURN", from: "FORWARDED_TO_FOCAL_PERSON", to: "RETURNED_FOR_CORRECTION" },
  { action: "RECORD_CORRECTIVE_ACTION", from: "RETURNED_FOR_CORRECTION", to: "RETURNED_FOR_CORRECTION" },
  { action: "RE_FORWARD", from: "RETURNED_FOR_CORRECTION", to: "FORWARDED_TO_FOCAL_PERSON" },
  { action: "PREPARE_OUTGOING", from: "APPROVED", to: "READY_FOR_TRANSMITTAL" },
  { action: "FINALIZE_TRANSMITTAL", from: "READY_FOR_TRANSMITTAL", to: "TRANSMITTED" },
  { action: "CANCEL", from: "RECEIVED", to: "CANCELLED" },
  { action: "CANCEL", from: "ENCODED", to: "CANCELLED" },
  { action: "CANCEL", from: "FORWARDED_TO_FOCAL_PERSON", to: "CANCELLED" },
  { action: "CANCEL", from: "RETURNED_FOR_CORRECTION", to: "CANCELLED" },
  { action: "CANCEL", from: "APPROVED", to: "CANCELLED" },
  { action: "CANCEL", from: "READY_FOR_TRANSMITTAL", to: "CANCELLED" },
] as const;

export const TERMINAL_STATUSES: readonly DocumentStatus[] = ["TRANSMITTED", "CANCELLED"];

export function resolveTransition(
  action: WorkflowAction,
  currentStatus: DocumentStatus | null,
): StatusTransition | undefined {
  return STATUS_TRANSITIONS.find((transition) => transition.action === action && transition.from === currentStatus);
}

export function canTransition(action: WorkflowAction, currentStatus: DocumentStatus | null): boolean {
  return resolveTransition(action, currentStatus) !== undefined;
}

export function isTerminal(status: DocumentStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function isEligibleForTransmittal(status: DocumentStatus): boolean {
  return status === "READY_FOR_TRANSMITTAL";
}

import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { db } from "../src/lib/db";
import {
  documentStatusTransitions,
  documentTypes,
  focalPersons,
  offices,
  permissions,
  rolePermissions,
  roles,
} from "../src/lib/db/schema";
import { PERMISSION_KEYS, ROLE_KEYS, ROLE_PERMISSION_MAP } from "../src/lib/auth/permissions";
import { STATUS_TRANSITIONS } from "../src/features/documents/status";

const OFFICES = [
  { code: "MO", name: "Office of the Municipal Mayor", shortName: "Mayor" },
  { code: "MAD", name: "Office of the Municipal Administrator", shortName: "Administrator" },
  { code: "MTREAS", name: "Municipal Treasurer's Office", shortName: "Treasurer" },
  { code: "MENG", name: "Municipal Engineer's Office", shortName: "Engineer" },
  { code: "MHR", name: "Municipal Human Resources Office", shortName: "HR" },
  { code: "MACC", name: "Municipal Accounting Office", shortName: "Accounting" },
] as const;

const FOCAL_PERSONS = [
  { name: "Atty. Rosa M. Villanueva", officeCode: "MO", position: "Municipal Attorney" },
  { name: "Engr. Juan D. Dela Cruz", officeCode: "MENG", position: "Municipal Engineer" },
  { name: "Ms. Lorna B. Reyes", officeCode: "MTREAS", position: "Municipal Treasurer" },
  { name: "Mr. Antonio P. Garcia", officeCode: "MACC", position: "Municipal Accountant" },
  { name: "Ms. Celia R. Mendoza", officeCode: "MHR", position: "HR Officer V" },
] as const;

const DOCUMENT_TYPES = [
  { key: "LETTER", name: "Letter" },
  { key: "MEMORANDUM", name: "Memorandum" },
  { key: "REQUEST", name: "Request" },
  { key: "REPORT", name: "Report" },
  { key: "INVOICE", name: "Invoice" },
  { key: "CERTIFICATE", name: "Certificate" },
] as const;

async function main(): Promise<void> {
  await db.insert(roles).values(
    Object.values(ROLE_KEYS).map((key) => ({
      key,
      name: key.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase()),
      description: `System role: ${key}`,
    })),
  ).onConflictDoNothing();

  await db.insert(permissions).values(
    PERMISSION_KEYS.map((key) => ({ key, description: key.replaceAll(":", " ") })),
  ).onConflictDoNothing();

  const roleRows = await db.select().from(roles);
  const permissionRows = await db.select().from(permissions);

  const rolePermissionValues = roleRows.flatMap((role) => {
    const granted = ROLE_PERMISSION_MAP[role.key as keyof typeof ROLE_PERMISSION_MAP] ?? [];
    return granted.flatMap((key) => {
      const permission = permissionRows.find((candidate) => candidate.key === key);
      return permission ? [{ roleId: role.id, permissionId: permission.id }] : [];
    });
  });
  if (rolePermissionValues.length > 0) {
    await db.insert(rolePermissions).values(rolePermissionValues).onConflictDoNothing();
  }

  await db.insert(documentTypes).values([...DOCUMENT_TYPES]).onConflictDoNothing();
  await db.insert(offices).values([...OFFICES]).onConflictDoNothing();

  const officeRows = await db.select().from(offices);
  const focalValues = FOCAL_PERSONS.flatMap((person) => {
    const office = officeRows.find((candidate) => candidate.code === person.officeCode);
    return office ? [{ fullName: person.name, officeId: office.id, position: person.position }] : [];
  });
  if (focalValues.length > 0) {
    // No user/account/session rows are created for focal persons.
    await db.insert(focalPersons).values(focalValues);
  }

  await db.insert(documentStatusTransitions).values(
    STATUS_TRANSITIONS.filter((transition) => transition.from !== null).map((transition) => ({
      fromStatus: transition.from,
      action: transition.action,
      toStatus: transition.to,
    })),
  ).onConflictDoNothing();

  console.log(`Seed complete: ${OFFICES.length} offices, ${FOCAL_PERSONS.length} focal persons (no accounts).`);
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("Seed failed:", error);
  process.exit(1);
});

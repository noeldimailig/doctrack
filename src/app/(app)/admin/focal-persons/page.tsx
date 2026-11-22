import { PageHeader } from "@/components/layout/page-header";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { SearchForm } from "@/components/shared/search-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FocalPersonFormDialog } from "@/features/admin/components/focal-person-form-dialog";
import { createFocalPerson, setFocalPersonActive, updateFocalPerson } from "@/features/admin/organization-actions";
import { getActiveDepartments, getActiveOffices, listFocalPersons } from "@/features/admin/queries";
import { requirePermission } from "@/lib/auth/session";

interface FocalPersonsPageProps {
  searchParams: Promise<{ q?: string }>;
}

export const instant = false;

export default async function FocalPersonsPage({ searchParams }: FocalPersonsPageProps) {
  await requirePermission("focal-person:manage");
  const { q = "" } = await searchParams;
  const [focalPersons, offices, departments] = await Promise.all([
    listFocalPersons(q),
    getActiveOffices(),
    getActiveDepartments(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Focal Person Management"
        description="Directory of physical reviewers and signatories. These records never receive application accounts."
        actions={
          <FocalPersonFormDialog action={createFocalPerson} offices={offices} departments={departments} />
        }
      />

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Focal persons</CardTitle>
            <CardDescription>{focalPersons.length} record(s)</CardDescription>
          </div>
          <SearchForm action="/admin/focal-persons" defaultValue={q} placeholder="Search focal persons..." />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Office / Department</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {focalPersons.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No focal persons found.
                  </TableCell>
                </TableRow>
              ) : (
                focalPersons.map((person) => (
                  <TableRow key={person.id}>
                    <TableCell className="font-medium">{person.fullName}</TableCell>
                    <TableCell>{person.position}</TableCell>
                    <TableCell>
                      <span>{person.officeName ?? "—"}</span>
                      {person.departmentName ? <span className="block text-xs text-muted-foreground">{person.departmentName}</span> : null}
                    </TableCell>
                    <TableCell>
                      <span className="block text-xs">{person.contactEmail ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">{person.contactNumber ?? ""}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={person.isActive ? "default" : "secondary"}>
                        {person.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <FocalPersonFormDialog
                          action={updateFocalPerson.bind(null, person.id)}
                          offices={offices}
                          departments={departments}
                          initialValues={{
                            id: person.id,
                            fullName: person.fullName,
                            position: person.position,
                            officeId: person.officeId ?? null,
                            departmentId: person.departmentId ?? null,
                            contactEmail: person.contactEmail,
                            contactNumber: person.contactNumber,
                          }}
                        />
                        <ConfirmActionButton
                          label={person.isActive ? "Deactivate" : "Activate"}
                          title={person.isActive ? "Deactivate focal person?" : "Activate focal person?"}
                          description="Historical review records remain unchanged."
                          action={setFocalPersonActive.bind(null, person.id, !person.isActive)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

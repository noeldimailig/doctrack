import { PageHeader } from "@/components/layout/page-header";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { SearchForm } from "@/components/shared/search-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DepartmentFormDialog } from "@/features/admin/components/department-form-dialog";
import { OfficeFormDialog } from "@/features/admin/components/office-form-dialog";
import { createDepartment, createOffice, setDepartmentActive, setOfficeActive, updateOffice } from "@/features/admin/organization-actions";
import { getActiveOffices, listDepartments, listOffices } from "@/features/admin/queries";
import { requirePermission } from "@/lib/auth/session";

interface OfficesPageProps {
  searchParams: Promise<{ q?: string }>;
}

export const instant = false;

export default async function OfficesPage({ searchParams }: OfficesPageProps) {
  await requirePermission("office:manage");
  const { q = "" } = await searchParams;
  const [offices, departments, officeOptions] = await Promise.all([
    listOffices(q),
    listDepartments(),
    getActiveOffices(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Office Management"
        description="Manage offices and departments used across the document workflow."
        actions={<OfficeFormDialog action={createOffice} offices={officeOptions} />}
      />

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Offices</CardTitle>
            <CardDescription>{offices.length} office record(s)</CardDescription>
          </div>
          <SearchForm action="/admin/offices" defaultValue={q} placeholder="Search offices..." />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Parent</TableHead>
                <TableHead>Departments</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    No offices found.
                  </TableCell>
                </TableRow>
              ) : (
                offices.map((office) => (
                  <TableRow key={office.id}>
                    <TableCell className="font-mono text-xs">{office.code}</TableCell>
                    <TableCell className="font-medium">{office.name}</TableCell>
                    <TableCell>{office.parentName ?? "—"}</TableCell>
                    <TableCell>{office.departmentCount}</TableCell>
                    <TableCell>
                      <Badge variant={office.isActive ? "default" : "secondary"}>
                        {office.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <OfficeFormDialog
                          action={updateOffice.bind(null, office.id)}
                          offices={officeOptions}
                          initialValues={{
                            id: office.id,
                            code: office.code,
                            name: office.name,
                            shortName: office.shortName,
                            parentOfficeId: office.parentOfficeId,
                          }}
                        />
                        <ConfirmActionButton
                          label={office.isActive ? "Deactivate" : "Activate"}
                          title={office.isActive ? "Deactivate office?" : "Activate office?"}
                          description="Existing records remain intact. Deactivated offices cannot be selected for new assignments."
                          action={setOfficeActive.bind(null, office.id, !office.isActive)}
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

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Departments</CardTitle>
            <CardDescription>Optional subdivisions within an office.</CardDescription>
          </div>
          <DepartmentFormDialog action={createDepartment} offices={officeOptions} />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Office</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No departments recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-mono text-xs">{department.code}</TableCell>
                    <TableCell className="font-medium">{department.name}</TableCell>
                    <TableCell>{department.officeName}</TableCell>
                    <TableCell>
                      <Badge variant={department.isActive ? "default" : "secondary"}>
                        {department.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <ConfirmActionButton
                        label={department.isActive ? "Deactivate" : "Activate"}
                        title={department.isActive ? "Deactivate department?" : "Activate department?"}
                        description="This only changes availability for new records."
                        action={setDepartmentActive.bind(null, department.id, !department.isActive)}
                      />
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

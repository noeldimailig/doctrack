"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FieldError } from "@/components/shared/field-error";
import type { ActionResult } from "@/lib/error/action-result";

interface UserFormValues {
  id: string;
  name: string;
  roleKeys: string[];
  officeId: string | null;
  departmentId: string | null;
}

interface UserFormDialogProps {
  action: (input: unknown) => Promise<ActionResult<{ id: string }>>;
  roles: Array<{ key: string; name: string }>;
  offices: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string; officeId: string }>;
  initialValues?: UserFormValues;
}

export function UserFormDialog({ action, roles, offices, departments, initialValues }: UserFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [name, setName] = useState(initialValues?.name ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    initialValues?.roleKeys ?? ["RECEIVING_PERSONNEL"],
  );
  const [officeId, setOfficeId] = useState(initialValues?.officeId ?? "none");
  const [departmentId, setDepartmentId] = useState(initialValues?.departmentId ?? "none");

  const availableDepartments = useMemo(
    () => departments.filter((department) => officeId === "none" || department.officeId === officeId),
    [departments, officeId],
  );

  function toggleRole(key: string) {
    setSelectedRoles((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  function handleOfficeChange(value: string) {
    setOfficeId(value);
    const stillValid = departments.some(
      (department) => department.id === departmentId && department.officeId === value,
    );
    if (!stillValid) setDepartmentId("none");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const input = initialValues
      ? {
          name,
          roleKeys: selectedRoles,
          officeId: officeId === "none" ? null : officeId,
          departmentId: departmentId === "none" ? null : departmentId,
        }
      : {
          name,
          email,
          password,
          roleKeys: selectedRoles,
          officeId: officeId === "none" ? null : officeId,
          departmentId: departmentId === "none" ? null : departmentId,
        };
    const result = await action(input);
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success(initialValues ? "User updated" : "User created");
    setOpen(false);
    if (!initialValues) {
      setEmail("");
      setPassword("");
    }
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={initialValues ? "ghost" : "default"}>
          {initialValues ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {initialValues ? "Edit" : "New user"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialValues ? "Edit application user" : "Create application user"}</DialogTitle>
          <DialogDescription>
            Accounts are issued by administrators only. Focal persons are managed separately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
            <FieldError messages={fieldErrors.name} />
          </div>
          {!initialValues ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Email address</Label>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                <FieldError messages={fieldErrors.email} />
              </div>
              <div className="space-y-2">
                <Label>Temporary password</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={12}
                  required
                />
                <p className="text-xs text-muted-foreground">At least 12 characters.</p>
                <FieldError messages={fieldErrors.password} />
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Roles</Label>
            <div className="flex flex-wrap gap-3 rounded-md border p-3">
              {roles.map((role) => (
                <label key={role.key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={selectedRoles.includes(role.key)}
                    onChange={() => toggleRole(role.key)}
                  />
                  {role.name}
                </label>
              ))}
            </div>
            <FieldError messages={fieldErrors.roleKeys} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Office</Label>
              <Select value={officeId} onValueChange={handleOfficeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={fieldErrors.officeId} />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={departmentId} onValueChange={setDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableDepartments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={fieldErrors.departmentId} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || selectedRoles.length === 0}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

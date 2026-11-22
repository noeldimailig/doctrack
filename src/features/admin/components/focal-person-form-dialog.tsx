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

interface FocalPersonFormValues {
  id: string;
  fullName: string;
  officeId: string | null;
  departmentId: string | null;
  position: string;
  contactEmail: string | null;
  contactNumber: string | null;
}

interface FocalPersonFormDialogProps {
  action: (input: unknown) => Promise<ActionResult<{ id: string }>>;
  offices: Array<{ id: string; name: string }>;
  departments: Array<{ id: string; name: string; officeId: string }>;
  initialValues?: FocalPersonFormValues;
}

export function FocalPersonFormDialog({ action, offices, departments, initialValues }: FocalPersonFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [fullName, setFullName] = useState(initialValues?.fullName ?? "");
  const [officeId, setOfficeId] = useState(initialValues?.officeId ?? "none");
  const [departmentId, setDepartmentId] = useState(initialValues?.departmentId ?? "none");
  const [position, setPosition] = useState(initialValues?.position ?? "");
  const [contactEmail, setContactEmail] = useState(initialValues?.contactEmail ?? "");
  const [contactNumber, setContactNumber] = useState(initialValues?.contactNumber ?? "");

  const availableDepartments = useMemo(
    () =>
      departments.filter(
        (department) => officeId === "none" || department.officeId === officeId,
      ),
    [departments, officeId],
  );

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
    const result = await action({
      fullName,
      officeId: officeId === "none" ? null : officeId,
      departmentId: departmentId === "none" ? null : departmentId,
      position,
      contactEmail,
      contactNumber,
    });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success(initialValues ? "Focal person updated" : "Focal person added");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={initialValues ? "ghost" : "default"}>
          {initialValues ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {initialValues ? "Edit" : "New focal person"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialValues ? "Edit focal person" : "Add focal person"}</DialogTitle>
          <DialogDescription>
            Directory record only. No login, password, session or application account is created.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
            <FieldError messages={fieldErrors.fullName} />
          </div>
          <div className="space-y-2">
            <Label>Position / designation</Label>
            <Input value={position} onChange={(event) => setPosition(event.target.value)} required />
            <FieldError messages={fieldErrors.position} />
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Contact email</Label>
              <Input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
              <FieldError messages={fieldErrors.contactEmail} />
            </div>
            <div className="space-y-2">
              <Label>Contact number</Label>
              <Input value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} />
              <FieldError messages={fieldErrors.contactNumber} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

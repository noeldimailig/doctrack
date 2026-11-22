"use client";

import { useState } from "react";
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

interface OfficeFormValues {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  parentOfficeId: string | null;
}

interface OfficeOption {
  id: string;
  name: string;
}

interface OfficeFormDialogProps {
  action: (input: unknown) => Promise<ActionResult<{ id: string }>>;
  offices: OfficeOption[];
  initialValues?: OfficeFormValues;
}

export function OfficeFormDialog({ action, offices, initialValues }: OfficeFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [code, setCode] = useState(initialValues?.code ?? "");
  const [name, setName] = useState(initialValues?.name ?? "");
  const [shortName, setShortName] = useState(initialValues?.shortName ?? "");
  const [parentOfficeId, setParentOfficeId] = useState(initialValues?.parentOfficeId ?? "none");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const result = await action({
      code,
      name,
      shortName,
      parentOfficeId: parentOfficeId === "none" ? null : parentOfficeId,
    });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success(initialValues ? "Office updated" : "Office created");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={initialValues ? "ghost" : "default"}>
          {initialValues ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {initialValues ? "Edit" : "New office"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialValues ? "Edit office" : "Create office"}</DialogTitle>
          <DialogDescription>Office records are used as destinations and organisational references.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`office-code-${initialValues?.id ?? "new"}`}>Code</Label>
              <Input
                id={`office-code-${initialValues?.id ?? "new"}`}
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="MENG"
                required
              />
              <FieldError messages={fieldErrors.code} />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`office-short-${initialValues?.id ?? "new"}`}>Short name</Label>
              <Input
                id={`office-short-${initialValues?.id ?? "new"}`}
                value={shortName}
                onChange={(event) => setShortName(event.target.value)}
                placeholder="Engineer"
              />
              <FieldError messages={fieldErrors.shortName} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`office-name-${initialValues?.id ?? "new"}`}>Name</Label>
            <Input
              id={`office-name-${initialValues?.id ?? "new"}`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Municipal Engineer's Office"
              required
            />
            <FieldError messages={fieldErrors.name} />
          </div>
          <div className="space-y-2">
            <Label>Parent office</Label>
            <Select value={parentOfficeId} onValueChange={setParentOfficeId}>
              <SelectTrigger>
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {offices
                  .filter((office) => office.id !== initialValues?.id)
                  .map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <FieldError messages={fieldErrors.parentOfficeId} />
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

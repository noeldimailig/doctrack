"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/shared/field-error";
import type { ActionResult } from "@/lib/error/action-result";

interface SettingFormDialogProps {
  action: (input: unknown) => Promise<ActionResult<{ key: string }>>;
  initialValues?: { key: string; valueText: string };
}

export function SettingFormDialog({ action, initialValues }: SettingFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [key, setKey] = useState(initialValues?.key ?? "");
  const [value, setValue] = useState(initialValues?.valueText ?? "{}");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const result = await action({ key, value });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success("System setting saved");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={initialValues ? "ghost" : "default"}>
          {initialValues ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {initialValues ? "Edit" : "New setting"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialValues ? "Edit system setting" : "Create system setting"}</DialogTitle>
          <DialogDescription>
            Values must be valid JSON. Do not store passwords or connection secrets here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Key</Label>
            <Input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              disabled={Boolean(initialValues)}
              placeholder="document.retention_years"
              required
            />
            <FieldError messages={fieldErrors.key} />
          </div>
          <div className="space-y-2">
            <Label>JSON value</Label>
            <Textarea value={value} onChange={(event) => setValue(event.target.value)} rows={8} required />
            <FieldError messages={fieldErrors.value} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Save setting
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

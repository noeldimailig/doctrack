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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError } from "@/components/shared/field-error";
import type { ActionResult } from "@/lib/error/action-result";

export interface DocumentFormOptions {
  documentTypes: Array<{ id: string; name: string }>;
  offices: Array<{ id: string; name: string }>;
  focalPersons: Array<{ id: string; fullName: string; position: string }>;
  applicationUsers: Array<{ id: string; name: string; banned: boolean | null }>;
}

export interface DocumentFormValues {
  id: string;
  referenceNumber: string | null;
  title: string;
  documentTypeId: string | null;
  documentDate: string | null;
  dateReceived: string;
  senderOfficeId: string | null;
  senderName: string | null;
  senderReference: string | null;
  assignedUserId: string;
  destinationOfficeId: string;
  intendedFocalPersonId: string;
  remarks: string | null;
}

interface DocumentFormDialogProps {
  action: (input: unknown) => Promise<ActionResult<{ id: string; trackingNumber?: string }>>;
  options: DocumentFormOptions;
  initialValues?: DocumentFormValues;
}

export function DocumentFormDialog({ action, options, initialValues }: DocumentFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [referenceNumber, setReferenceNumber] = useState(initialValues?.referenceNumber ?? "");
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [documentTypeId, setDocumentTypeId] = useState(initialValues?.documentTypeId ?? "none");
  const [documentDate, setDocumentDate] = useState(initialValues?.documentDate ?? "");
  const [dateReceived, setDateReceived] = useState(initialValues?.dateReceived ?? new Date().toISOString().slice(0, 10));
  const [senderOfficeId, setSenderOfficeId] = useState(initialValues?.senderOfficeId ?? "none");
  const [senderName, setSenderName] = useState(initialValues?.senderName ?? "");
  const [senderReference, setSenderReference] = useState(initialValues?.senderReference ?? "");
  const [assignedUserId, setAssignedUserId] = useState(initialValues?.assignedUserId ?? "");
  const [destinationOfficeId, setDestinationOfficeId] = useState(initialValues?.destinationOfficeId ?? "none");
  const [intendedFocalPersonId, setIntendedFocalPersonId] = useState(initialValues?.intendedFocalPersonId ?? "none");
  const [remarks, setRemarks] = useState(initialValues?.remarks ?? "");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const input = {
      referenceNumber,
      title,
      documentTypeId: documentTypeId === "none" ? null : documentTypeId,
      documentDate: documentDate || null,
      dateReceived,
      senderOfficeId: senderOfficeId === "none" ? null : senderOfficeId,
      senderName,
      senderReference,
      assignedUserId,
      destinationOfficeId: destinationOfficeId === "none" ? null : destinationOfficeId,
      intendedFocalPersonId: intendedFocalPersonId === "none" ? null : intendedFocalPersonId,
      remarks,
    };
    const result = await action(input);
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success(initialValues ? "Document updated" : `Document registered: ${result.data.trackingNumber}`);
    setOpen(false);
    router.push(`/documents/${result.data.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant={initialValues ? "outline" : "default"}>
          {initialValues ? <Pencil className="size-4" /> : <Plus className="size-4" />}
          {initialValues ? "Edit details" : "Register document"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{initialValues ? "Edit document" : "Register incoming document"}</DialogTitle>
          <DialogDescription>
            The internal tracking number is generated automatically. This records administrative processing, not the paper document&apos;s physical location.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Title / subject</Label>
              <Textarea value={title} onChange={(event) => setTitle(event.target.value)} rows={2} required />
              <FieldError messages={fieldErrors.title} />
            </div>
            <div className="space-y-2">
              <Label>Document reference number</Label>
              <Input value={referenceNumber} onChange={(event) => setReferenceNumber(event.target.value)} placeholder="Optional" />
              <FieldError messages={fieldErrors.referenceNumber} />
            </div>
            <div className="space-y-2">
              <Label>Document type</Label>
              <Select value={documentTypeId} onValueChange={setDocumentTypeId}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {options.documentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={fieldErrors.documentTypeId} />
            </div>
            <div className="space-y-2">
              <Label>Date of document</Label>
              <Input type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} />
              <FieldError messages={fieldErrors.documentDate} />
            </div>
            <div className="space-y-2">
              <Label>Date received</Label>
              <Input type="date" value={dateReceived} onChange={(event) => setDateReceived(event.target.value)} required />
              <FieldError messages={fieldErrors.dateReceived} />
            </div>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-semibold">Sender</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Sender office</Label>
                <Select value={senderOfficeId} onValueChange={setSenderOfficeId}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {options.offices.map((office) => (
                      <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError messages={fieldErrors.senderOfficeId} />
              </div>
              <div className="space-y-2">
                <Label>Sender name</Label>
                <Input value={senderName} onChange={(event) => setSenderName(event.target.value)} />
                <FieldError messages={fieldErrors.senderName} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Sender reference</Label>
                <Input value={senderReference} onChange={(event) => setSenderReference(event.target.value)} />
                <FieldError messages={fieldErrors.senderReference} />
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <p className="text-sm font-semibold">Assignment</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {!initialValues ? (
                <div className="space-y-2">
                  <Label>Assigned receiving personnel</Label>
                  <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                    <SelectTrigger><SelectValue placeholder="Select personnel" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="" disabled>Select personnel</SelectItem>
                      {options.applicationUsers.map((appUser) => (
                        <SelectItem key={appUser.id} value={appUser.id}>
                          {appUser.name}{appUser.banned ? " (deactivated)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError messages={fieldErrors.assignedUserId} />
                </div>
              ) : null}
              <div className="space-y-2">
                <Label>Destination office</Label>
                <Select value={destinationOfficeId} onValueChange={setDestinationOfficeId}>
                  <SelectTrigger><SelectValue placeholder="Select destination" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select destination</SelectItem>
                    {options.offices.map((office) => (
                      <SelectItem key={office.id} value={office.id}>{office.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError messages={fieldErrors.destinationOfficeId} />
              </div>
              <div className="space-y-2">
                <Label>Intended focal person</Label>
                <Select value={intendedFocalPersonId} onValueChange={setIntendedFocalPersonId}>
                  <SelectTrigger><SelectValue placeholder="Select focal person" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" disabled>Select focal person</SelectItem>
                    {options.focalPersons.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.fullName} — {person.position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError messages={fieldErrors.intendedFocalPersonId} />
              </div>
            </div>
          </section>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} />
            <FieldError messages={fieldErrors.remarks} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {initialValues ? "Save changes" : "Register document"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

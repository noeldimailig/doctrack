"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
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

export interface EligibleTransmittalDocument {
  id: string;
  trackingNumber: string;
  referenceNumber: string | null;
  title: string;
  destinationOfficeId: string | null;
  focalPersonName: string | null;
  outgoingDate: string | null;
}

interface TransmittalFormDialogProps {
  action: (input: unknown) => Promise<ActionResult<{ id: string; transmittalNumber: string }>>;
  offices: Array<{ id: string; name: string }>;
  focalPersons: Array<{ id: string; fullName: string; position: string; officeId: string | null }>;
  documents: EligibleTransmittalDocument[];
}

export function TransmittalFormDialog({ action, offices, focalPersons, documents }: TransmittalFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [destinationOfficeId, setDestinationOfficeId] = useState(offices[0]?.id ?? "");
  const [signatoryId, setSignatoryId] = useState("none");
  const [remarks, setRemarks] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const visibleDocuments = useMemo(
    () => documents.filter((document) => document.destinationOfficeId === destinationOfficeId),
    [documents, destinationOfficeId],
  );
  const availableSignatories = useMemo(
    () => focalPersons.filter((person) => person.officeId === destinationOfficeId),
    [focalPersons, destinationOfficeId],
  );

  function handleOfficeChange(value: string) {
    setDestinationOfficeId(value);
    setSignatoryId("none");
    setSelectedIds([]);
  }

  function toggleDocument(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const result = await action({
      destinationOfficeId,
      destinationSignatoryFocalPersonId: signatoryId === "none" ? null : signatoryId,
      remarks,
      documentIds: selectedIds,
    });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success(`Transmittal ${result.data.transmittalNumber} created as a draft`);
    setOpen(false);
    router.push(`/transmittals/${result.data.id}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={documents.length === 0 || offices.length === 0}>
          <Plus className="size-4" />
          Create transmittal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create a destination-specific transmittal</DialogTitle>
          <DialogDescription>
            Only signed documents that are ready for transmittal appear here. The report is a draft until you finalize it.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Destination office</Label>
              <Select value={destinationOfficeId} onValueChange={handleOfficeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination" />
                </SelectTrigger>
                <SelectContent>
                  {offices.map((office) => (
                    <SelectItem key={office.id} value={office.id}>
                      {office.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={fieldErrors.destinationOfficeId} />
            </div>
            <div className="space-y-2">
              <Label>Intended signatory (optional)</Label>
              <Select value={signatoryId} onValueChange={setSignatoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {availableSignatories.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.fullName} — {person.position}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This is recorded as a name snapshot. The focal person does not receive an application notification.
              </p>
              <FieldError messages={fieldErrors.destinationSignatoryFocalPersonId} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Documents to include</Label>
              <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
            </div>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3">
              {visibleDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No eligible documents for this destination. All documents here are already assigned to an active transmittal.
                </p>
              ) : (
                visibleDocuments.map((document) => (
                  <label key={document.id} className="flex items-start gap-3 rounded-md border p-2 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4"
                      checked={selectedIds.includes(document.id)}
                      onChange={() => toggleDocument(document.id)}
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-xs font-medium">{document.trackingNumber}</span>
                      <span className="block truncate font-medium">{document.title}</span>
                      <span className="block text-xs text-muted-foreground">
                        {document.focalPersonName ?? "No focal person recorded"}
                        {document.outgoingDate ? ` · Outgoing ${document.outgoingDate}` : ""}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>
            <FieldError messages={fieldErrors.documentIds} />
          </div>

          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} />
            <FieldError messages={fieldErrors.remarks} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || selectedIds.length === 0 || !destinationOfficeId}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Create draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

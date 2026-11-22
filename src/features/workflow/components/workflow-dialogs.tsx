"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send, CheckCircle2, Undo2, Wrench, XCircle } from "lucide-react";
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

function nowLocalInput(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

interface DialogProps {
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  focalPersons: Array<{ id: string; fullName: string; position: string }>;
  applicationUsers: Array<{ id: string; name: string }>;
  currentFocalPersonId: string | null;
  currentUserId: string;
}

export function ForwardDocumentDialog({ action, focalPersons, currentFocalPersonId }: DialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [focalPersonId, setFocalPersonId] = useState(currentFocalPersonId ?? "none");
  const [forwardedAt, setForwardedAt] = useState(nowLocalInput);
  const [remarks, setRemarks] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const result = await action({ focalPersonId, forwardedAt, remarks });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success("Forwarding recorded");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Send className="size-4" /> Forward</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record physical forwarding</DialogTitle>
          <DialogDescription>The focal person does not receive an application notification. Record the handoff after it happens physically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Focal person</Label>
            <Select value={focalPersonId} onValueChange={setFocalPersonId}>
              <SelectTrigger><SelectValue placeholder="Select focal person" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Select focal person</SelectItem>
                {focalPersons.map((person) => (
                  <SelectItem key={person.id} value={person.id}>{person.fullName} — {person.position}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError messages={fieldErrors.focalPersonId} />
          </div>
          <div className="space-y-2">
            <Label>Forwarded date and time</Label>
            <Input type="datetime-local" value={forwardedAt} onChange={(event) => setForwardedAt(event.target.value)} required />
            <FieldError messages={fieldErrors.forwardedAt} />
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} />
            <FieldError messages={fieldErrors.remarks} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || focalPersonId === "none"}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Record forwarding
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RecordDecisionDialog({ action, focalPersons, applicationUsers, currentFocalPersonId, currentUserId }: DialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [decision, setDecision] = useState<"APPROVED" | "RETURNED_FOR_CORRECTION">("APPROVED");
  const [focalPersonId, setFocalPersonId] = useState(currentFocalPersonId ?? "none");
  const [decisionDate, setDecisionDate] = useState(new Date().toISOString().slice(0, 10));
  const [returnedToReceivingAt, setReturnedToReceivingAt] = useState(nowLocalInput);
  const [remarks, setRemarks] = useState("");
  const [receivedByUserId, setReceivedByUserId] = useState(currentUserId);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const result = await action({ decision, focalPersonId, decisionDate, returnedToReceivingAt, remarks, receivedByUserId });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success(decision === "APPROVED" ? "Approval recorded" : "Return recorded");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default"><CheckCircle2 className="size-4" /> Record outcome</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record focal person decision</DialogTitle>
          <DialogDescription>
            The decision was made physically. You are recording it; your identity is stored separately in `recorded_by`.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Outcome</Label>
            <Select value={decision} onValueChange={(value) => setDecision(value as typeof decision)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="APPROVED">Signed / Approved</SelectItem>
                <SelectItem value="RETURNED_FOR_CORRECTION">Returned for correction</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Focal person who made the decision</Label>
            <Select value={focalPersonId} onValueChange={setFocalPersonId}>
              <SelectTrigger><SelectValue placeholder="Select focal person" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none" disabled>Select focal person</SelectItem>
                {focalPersons.map((person) => (
                  <SelectItem key={person.id} value={person.id}>{person.fullName} — {person.position}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError messages={fieldErrors.focalPersonId} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Decision date</Label>
              <Input type="date" value={decisionDate} onChange={(event) => setDecisionDate(event.target.value)} />
              <FieldError messages={fieldErrors.decisionDate} />
            </div>
            <div className="space-y-2">
              <Label>Returned to receiving at</Label>
              <Input type="datetime-local" value={returnedToReceivingAt} onChange={(event) => setReturnedToReceivingAt(event.target.value)} />
              <FieldError messages={fieldErrors.returnedToReceivingAt} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{decision === "RETURNED_FOR_CORRECTION" ? "Return remarks (required)" : "Approval notes"}</Label>
            <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={3} required={decision === "RETURNED_FOR_CORRECTION"} />
            <FieldError messages={fieldErrors.remarks} />
          </div>
          {decision === "RETURNED_FOR_CORRECTION" ? (
            <div className="space-y-2">
              <Label>Acknowledged by receiving personnel</Label>
              <Select value={receivedByUserId} onValueChange={setReceivedByUserId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {applicationUsers.map((appUser) => (
                    <SelectItem key={appUser.id} value={appUser.id}>{appUser.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError messages={fieldErrors.receivedByUserId} />
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending || focalPersonId === "none"}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              Record decision
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CorrectiveActionDialog({ action }: { action: (input: unknown) => Promise<ActionResult<unknown>> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [actionTaken, setActionTaken] = useState("");
  const [correctedAt, setCorrectedAt] = useState(nowLocalInput);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const result = await action({ actionTaken, correctedAt });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success("Corrective action recorded");
    setOpen(false);
    setActionTaken("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Wrench className="size-4" /> Record correction</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record corrective action</DialogTitle>
          <DialogDescription>Corrections are appended to the history. The document stays returned until it is forwarded again.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Action taken</Label>
            <Textarea value={actionTaken} onChange={(event) => setActionTaken(event.target.value)} rows={3} required />
            <FieldError messages={fieldErrors.actionTaken} />
          </div>
          <div className="space-y-2">
            <Label>Corrected at</Label>
            <Input type="datetime-local" value={correctedAt} onChange={(event) => setCorrectedAt(event.target.value)} />
            <FieldError messages={fieldErrors.correctedAt} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : null} Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CancelDocumentDialog({ action }: { action: (input: unknown) => Promise<ActionResult<unknown>> }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [reason, setReason] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const result = await action({ reason });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success("Document cancelled");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="destructive"><XCircle className="size-4" /> Cancel document</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel document</DialogTitle>
          <DialogDescription>Cancellation is restricted and requires a reason. The status history remains intact.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} required />
            <FieldError messages={fieldErrors.reason} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Keep document</Button>
            <Button type="submit" variant="destructive" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : null} Cancel document</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReadyForTransmittalDialog({
  action,
  hasOutgoingData,
}: {
  action: (input: unknown) => Promise<ActionResult<unknown>>;
  hasOutgoingData: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [outgoingDate, setOutgoingDate] = useState(new Date().toISOString().slice(0, 10));
  const [outgoingReferenceNumber, setOutgoingReferenceNumber] = useState("");
  const [remarks, setRemarks] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFieldErrors({});
    const result = await action({ outgoingDate, outgoingReferenceNumber, remarks });
    setPending(false);
    if (!result.ok) {
      if (result.fieldErrors) setFieldErrors(result.fieldErrors);
      toast.error(result.message);
      return;
    }
    toast.success("Document prepared for transmittal");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">{hasOutgoingData ? <Undo2 className="size-4" /> : null} Prepare outgoing</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Prepare for outgoing transmittal</DialogTitle>
          <DialogDescription>Only signed/approved documents can proceed to outgoing processing.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Outgoing date</Label>
              <Input type="date" value={outgoingDate} onChange={(event) => setOutgoingDate(event.target.value)} />
              <FieldError messages={fieldErrors.outgoingDate} />
            </div>
            <div className="space-y-2">
              <Label>Outgoing reference number</Label>
              <Input value={outgoingReferenceNumber} onChange={(event) => setOutgoingReferenceNumber(event.target.value)} />
              <FieldError messages={fieldErrors.outgoingReferenceNumber} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} rows={2} />
            <FieldError messages={fieldErrors.remarks} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? <Loader2 className="size-4 animate-spin" /> : null} Mark ready</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

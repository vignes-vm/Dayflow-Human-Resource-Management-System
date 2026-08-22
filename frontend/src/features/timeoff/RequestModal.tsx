import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TimeOffRequestPreviewResponse, TimeOffTypeDto } from "@dayflow/shared";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/useToast";
import { api, ApiClientError } from "@/lib/api";

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

export function RequestModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [typeId, setTypeId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const typesQuery = useQuery({
    queryKey: ["time-off", "types"],
    queryFn: () => api.get<{ data: TimeOffTypeDto[] }>("/time-off/types"),
  });
  const selectedType = typesQuery.data?.data.find((t) => t.id === typeId);

  const debouncedStart = useDebounced(startDate, 300);
  const debouncedEnd = useDebounced(endDate, 300);

  const previewQuery = useQuery({
    queryKey: ["time-off", "preview", typeId, debouncedStart, debouncedEnd],
    queryFn: () =>
      api.post<TimeOffRequestPreviewResponse>("/time-off/requests/preview", {
        typeId,
        startDate: debouncedStart,
        endDate: debouncedEnd,
      }),
    enabled: !!typeId && !!debouncedStart && !!debouncedEnd,
  });

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post("/time-off/requests", {
        typeId,
        startDate,
        endDate,
        reason: reason || undefined,
        attachmentUrl: attachmentUrl || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["time-off"] });
      toast({ variant: "success", title: "Request submitted" });
      onOpenChange(false);
      setTypeId("");
      setStartDate("");
      setEndDate("");
      setReason("");
      setAttachmentUrl("");
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not submit",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  const needsAttachment = selectedType?.requiresAttachment && !attachmentUrl;
  const canSubmit =
    !!typeId &&
    !!startDate &&
    !!endDate &&
    !needsAttachment &&
    !previewQuery.data?.error &&
    !submitMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Time off type request</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Time off Type</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {typesQuery.data?.data.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Validity Period</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">To</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="attachment">
              Attachment {selectedType?.requiresAttachment ? "(for sick leave certificate)" : ""}
            </Label>
            <Input
              id="attachment"
              placeholder="https://…"
              value={attachmentUrl}
              onChange={(e) => setAttachmentUrl(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          {previewQuery.data ? (
            <div className="bg-ink-100 rounded-card space-y-1 p-3 text-sm">
              <p>{previewQuery.data.workingDays} working day(s)</p>
              {previewQuery.data.excludedDates.map((e, i) => (
                <p key={i} className="text-ink-500 text-xs">
                  {e.date} — {e.reason}, not counted
                </p>
              ))}
              {previewQuery.data.balanceAfter !== null ? (
                <p className="text-ink-500 text-xs">
                  {previewQuery.data.balanceAfter} days remaining after this request
                </p>
              ) : null}
              {previewQuery.data.error ? (
                <p className="text-danger text-xs font-medium">{previewQuery.data.error}</p>
              ) : null}
            </div>
          ) : null}
          {needsAttachment ? (
            <p className="text-danger text-xs">An attachment is required for this type.</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Discard
          </Button>
          <Button onClick={() => submitMutation.mutate()} disabled={!canSubmit}>
            {submitMutation.isPending ? "Submitting…" : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

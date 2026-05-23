"use client";

import * as React from "react";
import { IconClockStop, IconTrash } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

type AutoStopScope = "selected" | "all";

type PendingAutoStop = {
  id: string;
  sshRemoteId: string | null;
  sshRemoteName: string | null;
  targetType: "SSH_REMOTE" | "ALL_ACTIVE";
  scheduledAt: string;
};

function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

function toDateInputValue(date: Date) {
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(
    date.getDate(),
  )}`;
}

function toTimeInputValue(date: Date) {
  return `${padTimePart(date.getHours())}:${padTimePart(
    date.getMinutes(),
  )}:${padTimePart(date.getSeconds())}`;
}

function getDefaultStopTime() {
  const date = new Date();
  date.setMinutes(date.getMinutes() + 30);
  date.setSeconds(0, 0);

  return {
    date: toDateInputValue(date),
    time: toTimeInputValue(date),
  };
}

function createLocalDateTime(dateValue: string, timeValue: string) {
  const normalizedTime = timeValue.length === 5 ? `${timeValue}:00` : timeValue;
  const date = new Date(`${dateValue}T${normalizedTime}`);

  return Number.isFinite(date.getTime()) ? date : null;
}

function formatScheduleTime(value: string) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(new Date(value));
}

function getScheduleTargetLabel(schedule: PendingAutoStop) {
  if (schedule.targetType === "ALL_ACTIVE") {
    return "All active machines";
  }

  return schedule.sshRemoteName ?? schedule.sshRemoteId ?? "Unknown machine";
}

export function AutoStopControl({
  selectedIds,
  totalCount,
}: {
  selectedIds: string[];
  totalCount: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [scope, setScope] = React.useState<AutoStopScope>(
    selectedIds.length > 0 ? "selected" : "all",
  );
  const [scheduledDate, setScheduledDate] = React.useState(
    () => getDefaultStopTime().date,
  );
  const [scheduledTime, setScheduledTime] = React.useState(
    () => getDefaultStopTime().time,
  );
  const [pendingSchedules, setPendingSchedules] = React.useState<
    PendingAutoStop[]
  >([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const selectedCount = selectedIds.length;
  const canUseSelectedScope = selectedCount > 0;
  const nextSchedule = pendingSchedules[0] ?? null;

  const loadSchedules = React.useCallback(async () => {
    setIsLoadingSchedules(true);

    try {
      const response = await fetch("/api/ssh/auto-stop", {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to load auto stop schedules");
      }

      setPendingSchedules(payload.data ?? []);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to load auto stop schedules",
      );
    } finally {
      setIsLoadingSchedules(false);
    }
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);

    if (nextOpen) {
      const defaults = getDefaultStopTime();

      setScope(selectedIds.length > 0 ? "selected" : "all");
      setScheduledDate(defaults.date);
      setScheduledTime(defaults.time);
      void loadSchedules();
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const date = createLocalDateTime(scheduledDate, scheduledTime);

    if (!date) {
      toast.error("Invalid auto stop time");
      return;
    }

    if (scope === "selected" && selectedIds.length === 0) {
      toast.error("Select at least one machine");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/ssh/auto-stop", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scope,
          ids: scope === "selected" ? selectedIds : [],
          scheduledAt: date.toISOString(),
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to schedule auto stop");
      }

      toast.success(
        scope === "all"
          ? "Auto stop scheduled for all active machines"
          : `Auto stop scheduled for ${selectedIds.length} machine(s)`,
      );
      await loadSchedules();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to schedule auto stop",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelSchedule = async (id: string) => {
    setDeletingId(id);

    try {
      const response = await fetch("/api/ssh/auto-stop", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ids: [id],
        }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to cancel auto stop");
      }

      toast.success("Auto stop canceled");
      await loadSchedules();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel auto stop",
      );
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        disabled={totalCount === 0}
        onClick={() => handleOpenChange(true)}
      >
        <IconClockStop />
        <span className="hidden lg:inline">
          Auto Stop{pendingSchedules.length > 0 ? ` (${pendingSchedules.length})` : ""}
        </span>
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Auto Stop</DialogTitle>
            <DialogDescription>
              Schedule provider stop and SSH disconnect for selected machines or all active machines.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Next stop</p>
                <p className="text-sm text-muted-foreground">
                  {nextSchedule
                    ? `${formatScheduleTime(nextSchedule.scheduledAt)} - ${getScheduleTargetLabel(
                        nextSchedule,
                      )}`
                    : isLoadingSchedules
                      ? "Loading schedules..."
                      : "No pending auto stop schedules"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isLoadingSchedules}
                onClick={() => void loadSchedules()}
              >
                Refresh
              </Button>
            </div>
            {pendingSchedules.length > 0 ? (
              <div className="mt-3 max-h-40 space-y-2 overflow-y-auto">
                {pendingSchedules.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {getScheduleTargetLabel(schedule)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatScheduleTime(schedule.scheduledAt)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={deletingId === schedule.id}
                      onClick={() => void handleCancelSchedule(schedule.id)}
                    >
                      <IconTrash className="size-4" />
                      <span className="sr-only">Cancel auto stop</span>
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label>Target</Label>
              <Select
                value={scope}
                onValueChange={(value) => setScope(value as AutoStopScope)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="selected"
                    disabled={!canUseSelectedScope}
                  >
                    Selected ({selectedCount})
                  </SelectItem>
                  <SelectItem value="all">All active machines</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
              <div className="space-y-2">
                <Label htmlFor="auto-stop-date">Stop date</Label>
                <Input
                  id="auto-stop-date"
                  type="date"
                  min={toDateInputValue(new Date())}
                  value={scheduledDate}
                  onChange={(event) => setScheduledDate(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="auto-stop-time">Time</Label>
                <Input
                  id="auto-stop-time"
                  type="time"
                  step={1}
                  value={scheduledTime}
                  onChange={(event) => setScheduledTime(event.target.value)}
                />
              </div>
            </div>
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Scheduled local time:{" "}
              <span className="font-medium text-foreground">
                {(() => {
                  const previewDate = createLocalDateTime(
                    scheduledDate,
                    scheduledTime,
                  );

                  return previewDate
                    ? formatScheduleTime(previewDate.toISOString())
                    : "Invalid time";
                })()}
              </span>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={isSaving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Scheduling" : "Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

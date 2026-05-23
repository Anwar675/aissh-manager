"use client";

import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconDotsVertical,
  IconGripVertical,
  IconLayoutColumns,
  IconPlus,
  IconServer,
} from "@tabler/icons-react";
import {
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnFiltersState,
  type Row,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { toast } from "sonner";
import { z } from "zod";

import { useIsMobile } from "@/hooks/use-mobile";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GoDotFill } from "react-icons/go";
import { AutoStopControl } from "./auto-stop";
import { CreateSSHDialog } from "./create";
import {
  formatDate,
  formatDuration,
  getBillingEnd,
  getHourlyPriceLabel,
  getTotalCostLabel,
  getUsageStart,
} from "@/lib/billing";
import { useDisplayCurrency } from "@/hooks/use-display-currency";
import { getVmTypeLabel } from "@/lib/vm-types";

export const schema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  host: z.string(),
  port: z.number(),
  username: z.string(),
  authType: z.string(),
  provider: z.string(),
  instanceId: z.string().optional().nullable(),
  machineType: z.string(),
  status: z.string(),
  isActive: z.boolean(),
  terminalRunning: z.boolean().optional(),
  terminalProgressPercent: z.number().optional().nullable(),
  createdAt: z.string(),
  cost: z.string().optional().nullable(),
  pricePerHour: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  usageStartedAt: z.string().optional().nullable(),
  usageEndedAt: z.string().optional().nullable(),
  connectedAt: z.string().optional().nullable(),
});

type VirtualMachine = z.infer<typeof schema>;

type TerminalStatePayload = {
  id: string;
  terminalRunning: boolean;
  terminalProgressPercent: number | null;
};

type EditSSHValues = {
  name: string;
  description: string;
  host: string;
  port: number;
  username: string;
  provider: string;
  instanceId: string;
  machineType: string;
  pricePerHour: string;
  password: string;
  sshKeyName: string;
  passphrase: string;
};

type CheckboxValue = boolean | "indeterminate";

const sortActiveFirst = (items: VirtualMachine[]) =>
  [...items].sort(
    (first, second) => Number(second.isActive) - Number(first.isActive),
  );

function DragHandle({ id }: { id: string }) {
  const { attributes, listeners } = useSortable({
    id,
  });

  return (
    <Button
      {...attributes}
      {...listeners}
      variant="ghost"
      size="icon"
      className="size-7 text-muted-foreground hover:bg-transparent"
    >
      <IconGripVertical className="size-3 text-muted-foreground" />
      <span className="sr-only">Drag to reorder</span>
    </Button>
  );
}

const formatAuthType = (authType: string) =>
  authType === "PRIVATE_KEY" ? "Private key" : "Password";

const getStatusDotClassName = (item: VirtualMachine) => {
  if (item.status === "Not available") {
    return "text-red-600";
  }

  if (item.status === "Connecting" || item.status === "Stopping") {
    return "text-yellow-500";
  }

  return item.isActive ? "text-green-600" : "text-zinc-400";
};

const getStatusBadgeClassName = (item: VirtualMachine) =>
  item.status === "Not available"
    ? "border-red-500/40 bg-red-500/10 px-1.5 text-red-600"
    : "px-1.5 text-muted-foreground";

const getTerminalProcessingDotClassName = (item: VirtualMachine) =>
  item.terminalRunning ? "text-green-600" : "text-zinc-400";

const getTerminalProcessingBadgeClassName = (item: VirtualMachine) =>
  item.terminalRunning
    ? "border-green-500/40 bg-green-500/10 px-1.5 text-green-600"
    : "px-1.5 text-muted-foreground";

const getTerminalProcessingLabel = (item: VirtualMachine) => {
  if (!item.terminalRunning) {
    return "Idle";
  }

  if (typeof item.terminalProgressPercent !== "number") {
    return "Running";
  }

  return `Running ${Math.round(item.terminalProgressPercent)}%`;
};

const RowSelectCheckbox = React.memo(function RowSelectCheckbox({
  id,
  checked,
  onSelectRow,
}: {
  id: string;
  checked: boolean;
  onSelectRow: (id: string, selected: boolean) => void;
}) {
  const [localChecked, setLocalChecked] = React.useState(checked);

  return (
    <Checkbox
      checked={localChecked}
      onCheckedChange={(value) => {
        const selected = value === true;
        setLocalChecked(selected);
        React.startTransition(() => {
          onSelectRow(id, selected);
        });
      }}
      aria-label="Select row"
    />
  );
});

const PageSelectCheckbox = React.memo(function PageSelectCheckbox({
  checked,
  pageRowIds,
  onSelectPageRows,
}: {
  checked: CheckboxValue;
  pageRowIds: string[];
  onSelectPageRows: (ids: string[], selected: boolean) => void;
}) {
  const [localChecked, setLocalChecked] =
    React.useState<CheckboxValue>(checked);

  return (
    <Checkbox
      checked={localChecked}
      onCheckedChange={(value) => {
        const selected = value === true;
        setLocalChecked(selected);
        React.startTransition(() => {
          onSelectPageRows(pageRowIds, selected);
        });
      }}
      aria-label="Select all"
    />
  );
});

type TableActions = {
  connectingIds: Set<string>;
  deletingIds: Set<string>;
  selectedIds: Set<string>;
  startingIds: Set<string>;
  stoppingIds: Set<string>;
  onConnect: (item: VirtualMachine) => void;
  onDelete: (item: VirtualMachine) => void;
  onEdit: (item: VirtualMachine) => void;
  onSelectPageRows: (ids: string[], selected: boolean) => void;
  onSelectRow: (id: string, selected: boolean) => void;
  onStart: (item: VirtualMachine) => void;
  onStop: (item: VirtualMachine) => void;
  onViewDetails: (item: VirtualMachine) => void;
};

const createColumns = ({
  connectingIds,
  deletingIds,
  selectedIds,
  startingIds,
  stoppingIds,
  onConnect,
  onDelete,
  onEdit,
  onSelectPageRows,
  onSelectRow,
  onStart,
  onStop,
  onViewDetails,
}: TableActions): ColumnDef<VirtualMachine>[] => [
  {
    id: "drag",
    header: () => null,
    cell: ({ row }) => <DragHandle id={row.original.id} />,
  },
  {
    id: "select",
    header: ({ table }) => {
      const pageRowIds = table
        .getPaginationRowModel()
        .rows.map((row) => row.original.id);
      const selectedPageRowCount = pageRowIds.filter((id) =>
        selectedIds.has(id),
      ).length;
      const isAllPageRowsSelected =
        pageRowIds.length > 0 && selectedPageRowCount === pageRowIds.length;
      const isSomePageRowsSelected =
        selectedPageRowCount > 0 && !isAllPageRowsSelected;
      const checked =
        isAllPageRowsSelected ||
        (isSomePageRowsSelected && "indeterminate");

      return (
        <div className="flex items-center justify-center">
          <PageSelectCheckbox
            key={`${pageRowIds.join("|")}-${checked}`}
            checked={checked}
            pageRowIds={pageRowIds}
            onSelectPageRows={onSelectPageRows}
          />
        </div>
      );
    },
    cell: ({ row }) => (
      <div className="flex items-center justify-center">
        <RowSelectCheckbox
          key={`${row.original.id}-${selectedIds.has(row.original.id)}`}
          id={row.original.id}
          checked={selectedIds.has(row.original.id)}
          onSelectRow={onSelectRow}
        />
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => {
      return (
        <MachineNameButton
          item={row.original}
          onViewDetails={onViewDetails}
        />
      );
    },
    enableHiding: false,
  },
  {
    accessorKey: "host",
    header: "Host",
    cell: ({ row }) => (
      <div className="font-mono text-sm text-muted-foreground">
        {row.original.host}
      </div>
    ),
  },
  {
    accessorKey: "port",
    header: () => <div className="w-full text-right">Port</div>,
    cell: ({ row }) => (
      <div className="text-right font-mono text-sm">{row.original.port}</div>
    ),
  },
  {
    accessorKey: "username",
    header: "User",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {row.original.username}
      </Badge>
    ),
  },
  {
    accessorKey: "authType",
    header: "Auth",
    cell: ({ row }) => (
      <Badge variant="outline" className="px-1.5 text-muted-foreground">
        {formatAuthType(row.original.authType)}
      </Badge>
    ),
  },
  {
    accessorKey: "provider",
    header: "Provider",
    cell: ({ row }) => (
      <span className="capitalize">{row.original.provider}</span>
    ),
  },
  {
    accessorKey: "machineType",
    header: "Type",
    cell: ({ row }) => (
      <span>{getVmTypeLabel(row.original.provider, row.original.machineType)}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={getStatusBadgeClassName(row.original)}
      >
        <GoDotFill className={getStatusDotClassName(row.original)} />
        {row.original.status}
      </Badge>
    ),
  },
  {
    accessorKey: "terminalRunning",
    header: "Processing",
    cell: ({ row }) => (
      <Badge
        variant="outline"
        className={getTerminalProcessingBadgeClassName(row.original)}
      >
        <GoDotFill className={getTerminalProcessingDotClassName(row.original)} />
        {getTerminalProcessingLabel(row.original)}
      </Badge>
    ),
  },
  {
    id: "actions",
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="flex size-8 text-muted-foreground data-[state=open]:bg-muted"
            size="icon"
          >
            <IconDotsVertical />
            <span className="sr-only">Open menu</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-32">
          <DropdownMenuItem onClick={() => onEdit(row.original)}>
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={
              connectingIds.has(row.original.id) ||
              deletingIds.has(row.original.id)
            }
            onClick={() => onConnect(row.original)}
          >
            {connectingIds.has(row.original.id) ? "Connecting" : "Connect"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={
              stoppingIds.has(row.original.id) ||
              startingIds.has(row.original.id) ||
              deletingIds.has(row.original.id) ||
              !row.original.isActive
            }
            onClick={() => onStop(row.original)}
          >
            {stoppingIds.has(row.original.id) ? "Stopping" : "Stop"}
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={
              startingIds.has(row.original.id) ||
              stoppingIds.has(row.original.id) ||
              deletingIds.has(row.original.id) ||
              row.original.isActive
            }
            onClick={() => onStart(row.original)}
          >
            {startingIds.has(row.original.id) ? "Starting" : "Start"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            disabled={deletingIds.has(row.original.id)}
            onClick={() => onDelete(row.original)}
          >
            {deletingIds.has(row.original.id) ? "Deleting" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

function DraggableRow({
  row,
  isSelected,
}: {
  row: Row<VirtualMachine>;
  isSelected: boolean;
}) {
  const { transform, transition, setNodeRef, isDragging } = useSortable({
    id: row.original.id,
  });

  return (
    <TableRow
      data-state={isSelected && "selected"}
      data-dragging={isDragging}
      ref={setNodeRef}
      className="relative z-0 data-[dragging=true]:z-10 data-[dragging=true]:opacity-80"
      style={{
        transform: CSS.Transform.toString(transform),
        transition: transition,
      }}
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  );
}

function EditSSHDialog({
  item,
  onOpenChange,
  onSave,
}: {
  item: VirtualMachine;
  onOpenChange: (open: boolean) => void;
  onSave: (item: VirtualMachine, values: EditSSHValues) => Promise<void>;
}) {
  const [formData, setFormData] = React.useState({
    name: item.name,
    host: item.host,
    port: String(item.port),
    username: item.username,
    provider: item.provider,
    instanceId: item.instanceId ?? "",
    machineType: item.machineType ?? "",
    pricePerHour:
      typeof item.pricePerHour === "number" ? String(item.pricePerHour) : "",
    password: "",
    sshKeyName: "",
    passphrase: "",
    description: item.description,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const nextErrors: Record<string, string> = {};
    const port = Number(formData.port);

    if (!formData.name.trim()) {
      nextErrors.name = "Connection name is required";
    }

    if (!formData.host.trim()) {
      nextErrors.host = "Host is required";
    }

    if (!formData.username.trim()) {
      nextErrors.username = "Username is required";
    }

    if (!Number.isInteger(port) || port <= 0) {
      nextErrors.port = "Valid port is required";
    }

    const pricePerHour =
      formData.pricePerHour.trim() === ""
        ? null
        : Number(formData.pricePerHour);

    if (pricePerHour !== null && (!Number.isFinite(pricePerHour) || pricePerHour < 0)) {
      nextErrors.pricePerHour = "Valid price is required";
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSaving(true);

    try {
      await onSave(item, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        host: formData.host.trim(),
        port,
        username: formData.username.trim(),
        provider: formData.provider.trim(),
        instanceId: formData.instanceId.trim(),
        machineType: formData.machineType.trim(),
        pricePerHour: formData.pricePerHour.trim(),
        password: formData.password,
        sshKeyName: formData.sshKeyName,
        passphrase: formData.passphrase,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update connection",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit SSH Connection</DialogTitle>
          <DialogDescription>Update machine connection details</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Connection Name</Label>
            <Input
              value={formData.name}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Username</Label>
              <Input
                value={formData.username}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    username: event.target.value,
                  }))
                }
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-500">{errors.username}</p>
              )}
            </div>

            <div>
              <Label>Host</Label>
              <Input
                value={formData.host}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    host: event.target.value,
                  }))
                }
              />
              {errors.host && (
                <p className="mt-1 text-sm text-red-500">{errors.host}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Port</Label>
              <Input
                value={formData.port}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    port: event.target.value,
                  }))
                }
              />
              {errors.port && (
                <p className="mt-1 text-sm text-red-500">{errors.port}</p>
              )}
            </div>

            <div>
              <Label>Provider</Label>
              <Input
                value={formData.provider}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    provider: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div>
            <Label>Provider Instance ID</Label>
            <Input
              placeholder="Pod ID, instance ID, machine ID, or ResourceGroup:VM"
              value={formData.instanceId}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  instanceId: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <Label>Machine Type</Label>
            <Input
              placeholder="Filled from provider API"
              value={formData.machineType}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  machineType: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <Label>Price/hour</Label>
            <Input
              inputMode="decimal"
              placeholder="0.50"
              value={formData.pricePerHour}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  pricePerHour: event.target.value,
                }))
              }
            />
            {errors.pricePerHour && (
              <p className="mt-1 text-sm text-red-500">
                {errors.pricePerHour}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep current"
                value={formData.password}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    password: event.target.value,
                  }))
                }
              />
            </div>

            <div>
              <Label>SSH Key Name</Label>
              <Input
                placeholder="Leave blank to keep current"
                value={formData.sshKeyName}
                onChange={(event) =>
                  setFormData((current) => ({
                    ...current,
                    sshKeyName: event.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div>
            <Label>Passphrase</Label>
            <Input
              type="password"
              placeholder="Leave blank to keep current"
              value={formData.passphrase}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  passphrase: event.target.value,
                }))
              }
            />
          </div>

          <div>
            <Label>Description</Label>
            <Input
              value={formData.description}
              onChange={(event) =>
                setFormData((current) => ({
                  ...current,
                  description: event.target.value,
                }))
              }
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSaving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DataTable({ data: initialData }: { data: VirtualMachine[] }) {
  const router = useRouter();
  const [data, setData] = React.useState(() => sortActiveFirst(initialData));
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [isOpen, setIsOpen] = React.useState(false);
  const [connectingIds, setConnectingIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [startingIds, setStartingIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [stoppingIds, setStoppingIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [selectedDetailsId, setSelectedDetailsId] = React.useState<
    string | null
  >(null);
  const [editingItem, setEditingItem] = React.useState<VirtualMachine | null>(
    null,
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const sortableId = React.useId();
  const sensors = useSensors(
    useSensor(MouseSensor, {}),
    useSensor(TouchSensor, {}),
    useSensor(KeyboardSensor, {}),
  );

  const dataIds = React.useMemo<UniqueIdentifier[]>(
    () => data?.map(({ id }) => id) || [],
    [data],
  );
  const selectedIds = React.useMemo(
    () =>
      new Set(
        Object.entries(rowSelection)
          .filter(([, selected]) => selected)
          .map(([id]) => id),
      ),
    [rowSelection],
  );
  const selectedIdList = React.useMemo(
    () => Array.from(selectedIds),
    [selectedIds],
  );
  const selectedDetailsItem = React.useMemo(
    () => data.find((item) => item.id === selectedDetailsId) ?? null,
    [data, selectedDetailsId],
  );

  React.useEffect(() => {
    setData(sortActiveFirst(initialData));
  }, [initialData]);

  React.useEffect(() => {
    let cancelled = false;

    const syncTerminalStates = async () => {
      try {
        const response = await fetch("/api/ssh/terminal-states", {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          success?: boolean;
          data?: TerminalStatePayload[];
        };

        if (!response.ok || !payload.success || !payload.data || cancelled) {
          return;
        }

        const statesById = new Map(
          payload.data.map((state) => [state.id, state]),
        );

        setData((current) =>
          current.map((machine) => {
            const terminalState = statesById.get(machine.id);

            if (!terminalState) {
              return machine;
            }

            return {
              ...machine,
              terminalRunning: terminalState.terminalRunning,
              terminalProgressPercent:
                terminalState.terminalProgressPercent,
            };
          }),
        );
      } catch {
        // Runtime terminal state is best-effort; keep the last known table state.
      }
    };

    void syncTerminalStates();
    const intervalId = window.setInterval(syncTerminalStates, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleConnect = React.useCallback(
    async (item: VirtualMachine) => {
      setConnectingIds((current) => new Set(current).add(item.id));
      setData((current) =>
        current.map((machine) =>
          machine.id === item.id
            ? {
                ...machine,
                status: "Connecting",
              }
            : machine,
        ),
      );

      try {
        const response = await fetch(
          `/api/ssh/${encodeURIComponent(item.id)}/connect`,
          {
            method: "POST",
          },
        );

        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Not available");
        }

        const connectedAt = new Date().toISOString();

        setData((current) =>
          sortActiveFirst(
            current.map((machine) =>
              machine.id === item.id
                ? {
	                    ...machine,
	                    isActive: true,
	                    terminalRunning: false,
	                    terminalProgressPercent: null,
	                    status: "Active",
                    connectedAt,
                    usageStartedAt: connectedAt,
                    usageEndedAt: null,
                  }
                : machine,
            ),
          ),
        );

        toast.success(`Connected to ${item.name}`);
        router.push(`/dashboard/${item.id}`);
        router.refresh();
      } catch (error) {
        setData((current) =>
          current.map((machine) =>
            machine.id === item.id
              ? {
	                  ...machine,
	                  isActive: false,
	                  terminalRunning: false,
	                  terminalProgressPercent: null,
	                  status: "Not available",
                }
              : machine,
          ),
        );

        toast.error(
          error instanceof Error ? error.message : "Machine not available",
        );
      } finally {
        setConnectingIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    },
    [router],
  );

  const handleDelete = React.useCallback(
    async (item: VirtualMachine) => {
      const confirmed = window.confirm(
        `Delete SSH connection "${item.name}"? This cannot be undone.`,
      );

      if (!confirmed) {
        return;
      }

      setDeletingIds((current) => new Set(current).add(item.id));

      try {
        const response = await fetch(
          `/api/ssh/${encodeURIComponent(item.id)}`,
          {
            method: "DELETE",
          },
        );
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to delete SSH connection");
        }

        setData((current) =>
          sortActiveFirst(current.filter((machine) => machine.id !== item.id)),
        );
        setRowSelection((current) => {
          const next = {
            ...current,
          } as Record<string, boolean>;
          delete next[item.id];
          return next;
        });

        toast.success(`Deleted ${item.name}`);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to delete SSH connection",
        );
      } finally {
        setDeletingIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    },
    [router],
  );

  const handleEdit = React.useCallback(
    async (item: VirtualMachine, values: EditSSHValues) => {
      const response = await fetch(`/api/ssh/${encodeURIComponent(item.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });
      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? "Failed to update SSH connection");
      }

      setData((current) =>
        sortActiveFirst(
          current.map((machine) =>
            machine.id === item.id
              ? {
                  ...machine,
                  ...payload.data,
                }
              : machine,
          ),
        ),
      );

      toast.success(`Updated ${values.name}`);
      router.refresh();
    },
    [router],
  );

  const handleSelectRow = React.useCallback(
    (id: string, selected: boolean) => {
      setRowSelection((current) => {
        const next: RowSelectionState = { ...current };

        if (selected) {
          next[id] = true;
        } else {
          delete next[id];
        }

        return next;
      });
    },
    [],
  );

  const handleSelectPageRows = React.useCallback(
    (ids: string[], selected: boolean) => {
      setRowSelection((current) => {
        const next: RowSelectionState = { ...current };

        for (const id of ids) {
          if (selected) {
            next[id] = true;
          } else {
            delete next[id];
          }
        }

        return next;
      });
    },
    [],
  );

  const handleStop = React.useCallback(
    async (item: VirtualMachine) => {
      setStoppingIds((current) => new Set(current).add(item.id));
      setData((current) =>
        current.map((machine) =>
          machine.id === item.id
            ? {
                ...machine,
                status: "Stopping",
              }
            : machine,
        ),
      );

      try {
        const response = await fetch(
          `/api/ssh/${encodeURIComponent(item.id)}/stop`,
          {
            method: "POST",
          },
        );
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to stop SSH connection");
        }

        const usageEndedAt = new Date().toISOString();

        setData((current) =>
          sortActiveFirst(
            current.map((machine) =>
              machine.id === item.id
                ? {
	                    ...machine,
	                    isActive: false,
	                    terminalRunning: false,
	                    terminalProgressPercent: null,
	                    status: "Saved",
                    usageEndedAt,
                  }
                : machine,
            ),
          ),
        );

        toast.success(`Stopped ${item.name}`);
        router.refresh();
      } catch (error) {
        setData((current) =>
          current.map((machine) =>
            machine.id === item.id
	              ? {
	                  ...machine,
	                  status: machine.isActive ? "Active" : "Saved",
	                }
              : machine,
          ),
        );

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to stop SSH connection",
        );
      } finally {
        setStoppingIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    },
    [router],
  );

  const handleStart = React.useCallback(
    async (item: VirtualMachine) => {
      setStartingIds((current) => new Set(current).add(item.id));
      setData((current) =>
        current.map((machine) =>
          machine.id === item.id
            ? {
                ...machine,
                status: "Starting",
              }
            : machine,
        ),
      );

      try {
        const response = await fetch(
          `/api/ssh/${encodeURIComponent(item.id)}/start`,
          {
            method: "POST",
          },
        );
        const payload = await response.json();

        if (!response.ok || !payload.success) {
          throw new Error(payload.error ?? "Failed to start SSH connection");
        }

        const usageStartedAt =
          payload.data?.usageStartedAt ?? new Date().toISOString();

        setData((current) =>
          sortActiveFirst(
            current.map((machine) =>
              machine.id === item.id
                ? {
	                    ...machine,
	                    isActive: true,
	                    terminalRunning: false,
	                    terminalProgressPercent: null,
	                    status: "Active",
                    usageStartedAt,
                    usageEndedAt: null,
                  }
                : machine,
            ),
          ),
        );

        toast.success(`Started ${item.name}`);
        router.refresh();
      } catch (error) {
        setData((current) =>
          current.map((machine) =>
            machine.id === item.id
	              ? {
	                  ...machine,
	                  status: machine.isActive ? "Active" : "Saved",
	                }
              : machine,
          ),
        );

        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to start SSH connection",
        );
      } finally {
        setStartingIds((current) => {
          const next = new Set(current);
          next.delete(item.id);
          return next;
        });
      }
    },
    [router],
  );

  const handleViewDetails = React.useCallback((item: VirtualMachine) => {
    setSelectedDetailsId(item.id);
  }, []);

  const columns = React.useMemo(
    () =>
      createColumns({
        connectingIds,
        deletingIds,
        selectedIds,
        startingIds,
        stoppingIds,
        onConnect: handleConnect,
        onDelete: handleDelete,
        onEdit: setEditingItem,
        onSelectPageRows: handleSelectPageRows,
        onSelectRow: handleSelectRow,
        onStart: handleStart,
        onStop: handleStop,
        onViewDetails: handleViewDetails,
      }),
    [
      connectingIds,
      deletingIds,
      selectedIds,
      startingIds,
      stoppingIds,
      handleConnect,
      handleDelete,
      handleSelectPageRows,
      handleSelectRow,
      handleStart,
      handleStop,
      handleViewDetails,
    ],
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      columnFilters,
      pagination,
    },
    getRowId: (row) => row.id.toString(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      setData((data) => {
        const oldIndex = dataIds.indexOf(active.id);
        const newIndex = dataIds.indexOf(over.id);
        return sortActiveFirst(arrayMove(data, oldIndex, newIndex));
      });
    }
  }

  return (
    <Tabs
      defaultValue="outline"
      className="w-full flex-col py-4 justify-start gap-6"
    >
      <div className="flex items-center justify-between px-4 lg:px-6">
        <CreateSSHDialog
          open={isOpen}
          onOpenChange={setIsOpen}
          onCreate={(connection) => {
            setData((current) =>
              sortActiveFirst([
                {
                  id: connection.id,
                  name: connection.name,
                  description: connection.description ?? "",
                  host: connection.host,
                  port: connection.port,
                  username: connection.username,
                  authType: connection.password ? "PASSWORD" : "PRIVATE_KEY",
                  provider: connection.provider ?? "local",
                  instanceId: connection.instanceId ?? null,
                  machineType: connection.machineType ?? "",
	                  status: "Saved",
	                  isActive: false,
	                  terminalRunning: false,
	                  terminalProgressPercent: null,
	                  pricePerHour: connection.pricePerHour ?? null,
                  currency: "USD",
                  usageStartedAt: null,
                  usageEndedAt: null,
                  connectedAt: null,
                  createdAt: connection.createdAt,
                },
                ...current,
              ]),
            );
          }}
        />
        {editingItem ? (
          <EditSSHDialog
            key={editingItem.id}
            item={editingItem}
            onOpenChange={(open) => {
              if (!open) {
                setEditingItem(null);
              }
            }}
            onSave={handleEdit}
          />
        ) : null}
        {selectedDetailsItem ? (
          <MachineDetailsDrawer
            key={selectedDetailsItem.id}
            item={selectedDetailsItem}
            open={selectedDetailsItem !== null}
            isConnecting={connectingIds.has(selectedDetailsItem.id)}
            isDeleting={deletingIds.has(selectedDetailsItem.id)}
            isStarting={startingIds.has(selectedDetailsItem.id)}
            isStopping={stoppingIds.has(selectedDetailsItem.id)}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedDetailsId(null);
              }
            }}
            onConnect={handleConnect}
            onDelete={handleDelete}
            onEdit={(item) => {
              setEditingItem(item);
              setSelectedDetailsId(null);
            }}
            onStart={handleStart}
            onStop={handleStop}
          />
        ) : null}
        <Label htmlFor="view-selector" className="sr-only">
          View
        </Label>
        <IconServer className="size-9 ml-5" />
        <TabsList className="hidden **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1 @4xl/main:flex">
          <TabsTrigger value="outline">All machines</TabsTrigger>
          <Badge variant="secondary">
            {data.filter((item) => item.isActive).length} active
          </Badge>
          <Badge variant="secondary">
            {data.filter((item) => !item.isActive).length} saved
          </Badge>
        </TabsList>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconLayoutColumns />
                <span className="hidden lg:inline">Customize Columns</span>
                <span className="lg:hidden">Columns</span>
                <IconChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {table
                .getAllColumns()
                .filter(
                  (column) =>
                    typeof column.accessorFn !== "undefined" &&
                    column.getCanHide(),
                )
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
          <AutoStopControl
            selectedIds={selectedIdList}
            totalCount={data.length}
          />
          <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
            <IconPlus />
            <span className="hidden lg:inline">Add New</span>
          </Button>
        </div>
      </div>
      <TabsContent
        value="outline"
        className="relative flex flex-col gap-4 overflow-auto px-4 lg:px-6"
      >
        <div className="overflow-hidden rounded-lg border">
          <DndContext
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={handleDragEnd}
            sensors={sensors}
            id={sortableId}
          >
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      return (
                        <TableHead key={header.id} colSpan={header.colSpan}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext(),
                              )}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody className="**:data-[slot=table-cell]:first:w-8">
                {table.getRowModel().rows?.length ? (
                  <SortableContext
                    items={dataIds}
                    strategy={verticalListSortingStrategy}
                  >
                    {table.getRowModel().rows.map((row) => (
                      <DraggableRow
                        key={row.id}
                        row={row}
                        isSelected={selectedIds.has(row.original.id)}
                      />
                    ))}
                  </SortableContext>
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 text-center"
                    >
                      No results.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
        <div className="flex items-center justify-between px-4">
          <div className="hidden flex-1 text-sm text-muted-foreground lg:flex">
            {
              table
                .getFilteredRowModel()
                .rows.filter((row) => selectedIds.has(row.original.id)).length
            }{" "}
            of{" "}
            {table.getFilteredRowModel().rows.length} row(s) selected.
          </div>
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor="rows-per-page" className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger size="sm" className="w-20" id="rows-per-page">
                  <SelectValue
                    placeholder={table.getState().pagination.pageSize}
                  />
                </SelectTrigger>
                <SelectContent side="top">
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex w-fit items-center justify-center text-sm font-medium">
              Page {table.getState().pagination.pageIndex + 1} of{" "}
              {table.getPageCount()}
            </div>
            <div className="ml-auto flex items-center gap-2 lg:ml-0">
              <Button
                variant="outline"
                className="hidden h-8 w-8 p-0 lg:flex"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                className="size-8"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                className="hidden size-8 lg:flex"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function MachineNameButton({
  item,
  onViewDetails,
}: {
  item: VirtualMachine;
  onViewDetails: (item: VirtualMachine) => void;
}) {
  return (
    <Button
      variant="link"
      className="w-fit px-0 text-left text-foreground"
      onClick={() => onViewDetails(item)}
    >
      {item.name}
    </Button>
  );
}

function MachineDetailsDrawer({
  item,
  open,
  isConnecting,
  isDeleting,
  isStarting,
  isStopping,
  onOpenChange,
  onConnect,
  onDelete,
  onEdit,
  onStart,
  onStop,
}: {
  item: VirtualMachine;
  open: boolean;
  isConnecting: boolean;
  isDeleting: boolean;
  isStarting: boolean;
  isStopping: boolean;
  onOpenChange: (open: boolean) => void;
  onConnect: (item: VirtualMachine) => void;
  onDelete: (item: VirtualMachine) => void;
  onEdit: (item: VirtualMachine) => void;
  onStart: (item: VirtualMachine) => void;
  onStop: (item: VirtualMachine) => void;
}) {
  const isMobile = useIsMobile();
  const billingDate = React.useMemo(() => new Date(), []);
  const { displayCurrency, toggleDisplayCurrency } = useDisplayCurrency();

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction={isMobile ? "bottom" : "right"}
    >
      <DrawerContent className="max-w-md">
        <div className="flex flex-col h-full">
          {/* Header */}
          <DrawerHeader className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <DrawerTitle className="text-lg">{item.name}</DrawerTitle>
                <div className="flex items-center gap-2 mt-1">
                  <GoDotFill
                    className={`${getStatusDotClassName(item)} size-2`}
                  />
                  <span
                    className={`text-xs ${
                      item.status === "Not available"
                        ? "text-red-600"
                        : "text-muted-foreground"
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="size-8">
                  <IconChevronRight className="size-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                CONNECTION
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Host</span>
                  <span className="font-mono text-xs">{item.host}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Port</span>
                  <span className="font-mono text-xs">{item.port}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-medium">{item.username}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Auth</span>
                  <span className="font-medium">
                    {formatAuthType(item.authType)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">DETAILS</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Provider</span>
                  <span className="font-medium capitalize">
                    {item.provider}
                  </span>
                </div>
                {item.instanceId ? (
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Instance ID</span>
                    <span className="font-mono text-xs font-medium">
                      {item.instanceId}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">
                    {getVmTypeLabel(item.provider, item.machineType)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span className="font-medium">
                    {formatDate(item.createdAt)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">
                  BILLING
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={toggleDisplayCurrency}
                >
                  {displayCurrency}
                </Button>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Price/hour</span>
                  <span className="font-medium">
                    {getHourlyPriceLabel(item, displayCurrency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Usage time</span>
                  <span className="font-medium">
                    {formatDuration(
                      getUsageStart(item),
                      getBillingEnd(item, billingDate),
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Total cost</span>
                  <span className="font-semibold">
                    {getTotalCostLabel(item, billingDate, displayCurrency)}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                DESCRIPTION
              </h3>
              <p className="text-sm text-muted-foreground">
                {item.description || "No description"}
              </p>
            </div>
          </div>

          <div className="border-t p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={isConnecting || isDeleting}
                onClick={() => onConnect(item)}
              >
                {isConnecting ? "Connecting" : "Connect"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={!item.isActive || isStopping || isStarting || isDeleting}
                onClick={() => onStop(item)}
              >
                {isStopping ? "Stopping" : "Stop"}
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={item.isActive || isStarting || isStopping || isDeleting}
                onClick={() => onStart(item)}
              >
                {isStarting ? "Starting" : "Start"}
              </Button>
              <Button
                onClick={() => onEdit(item)}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={isConnecting || isDeleting || isStarting || isStopping}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="text-xs"
                disabled={isDeleting || isStarting || isStopping}
                onClick={() => onDelete(item)}
              >
                {isDeleting ? "Deleting" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

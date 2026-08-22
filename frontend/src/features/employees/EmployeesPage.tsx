import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check, Copy, Plus, Search } from "lucide-react";
import {
  createEmployeeSchema,
  type CreateEmployeeInput,
  type Department,
  type EmployeeCard,
  type ListEmployeesQuery,
  type NewEmployeeCredentials,
  type PresenceState,
} from "@dayflow/shared";

import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { PresenceDot } from "@/components/PresenceDot";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { api, ApiClientError } from "@/lib/api";
import { queryKeys } from "@/lib/queryKeys";

interface EmployeesResponse {
  data: EmployeeCard[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

const PRESENCE_FILTERS: { value: PresenceState | "ALL"; label: string }[] = [
  { value: "ALL", label: "All presence" },
  { value: "GREEN", label: "Present" },
  { value: "AIRPLANE", label: "On leave" },
  { value: "YELLOW", label: "Absent" },
  { value: "RED", label: "Not checked in" },
];

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function EmployeesPage() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [departmentId, setDepartmentId] = useState<string | undefined>(undefined);
  const [presence, setPresence] = useState<PresenceState | "ALL">("ALL");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [credentials, setCredentials] = useState<NewEmployeeCredentials | null>(null);

  const canCreate = me?.user.role === "ADMIN" || me?.user.role === "HR";

  const query: ListEmployeesQuery = {
    search: search || undefined,
    departmentId,
    presence: presence === "ALL" ? undefined : presence,
    page: 1,
    pageSize: 50,
  };

  const employeesQuery = useQuery({
    queryKey: queryKeys.employees(query),
    queryFn: () => {
      const params = new URLSearchParams();
      if (query.search) params.set("search", query.search);
      if (query.departmentId) params.set("departmentId", query.departmentId);
      if (query.presence) params.set("presence", query.presence);
      params.set("page", String(query.page));
      params.set("pageSize", String(query.pageSize));
      return api.get<EmployeesResponse>(`/employees?${params.toString()}`);
    },
  });

  const departmentsQuery = useQuery({
    queryKey: queryKeys.departments(),
    queryFn: () => api.get<{ data: Department[] }>("/employees/departments/all"),
  });

  const hasFilters = Boolean(search || departmentId || presence !== "ALL");
  const clearFilters = () => {
    setSearch("");
    setDepartmentId(undefined);
    setPresence("ALL");
  };

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Every person at the company, live presence at a glance."
        actions={
          canCreate ? (
            <Button onClick={() => setDrawerOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              New
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search
            className="text-ink-400 pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            placeholder="Search name, title, login ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            aria-label="Search employees"
          />
        </div>
        <Select
          value={departmentId ?? "ALL"}
          onValueChange={(v) => setDepartmentId(v === "ALL" ? undefined : v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All departments</SelectItem>
            {departmentsQuery.data?.data.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={presence} onValueChange={(v) => setPresence(v as PresenceState | "ALL")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Presence" />
          </SelectTrigger>
          <SelectContent>
            {PRESENCE_FILTERS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {employeesQuery.isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : employeesQuery.isError ? (
        <ErrorState onRetry={() => employeesQuery.refetch()} />
      ) : !employeesQuery.data || employeesQuery.data.data.length === 0 ? (
        <EmptyState
          title="No employees match these filters"
          description={
            hasFilters ? "Try clearing your filters." : "Add your first employee to get started."
          }
          action={hasFilters ? { label: "Clear filters", onClick: clearFilters } : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {employeesQuery.data.data.map((emp, i) => (
            <motion.button
              key={emp.id}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              onClick={() =>
                navigate(emp.userId === me?.user.id ? "/profile/me" : `/employees/${emp.id}`)
              }
              className="rounded-card border-border bg-surface shadow-elevation focus-visible:ring-focusRing hover:bg-ink-100 relative flex flex-col items-start gap-3 border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2"
            >
              <PresenceDot state={emp.presence} className="absolute right-4 top-4" />
              <Avatar className="h-12 w-12">
                <AvatarImage src={emp.avatarUrl ?? undefined} alt="" />
                <AvatarFallback>{initials(emp.firstName, emp.lastName)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-display text-ink-900 text-sm font-semibold">
                  {emp.firstName} {emp.lastName}
                </p>
                <p className="text-ink-500 text-xs">
                  {emp.jobTitle ?? "—"}
                  {emp.department ? ` · ${emp.department.name}` : ""}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <CreateEmployeeDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        departments={departmentsQuery.data?.data ?? []}
        onCreated={(creds) => setCredentials(creds)}
      />

      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
    </div>
  );
}

function CreateEmployeeDrawer({
  open,
  onOpenChange,
  departments,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  departments: Department[];
  onCreated: (credentials: NewEmployeeCredentials) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateEmployeeInput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: { role: "EMPLOYEE", workLocation: "OFFICE" },
  });

  const mutation = useMutation({
    mutationFn: (values: CreateEmployeeInput) =>
      api.post<{ employee: { id: string; loginId: string }; credentials: NewEmployeeCredentials }>(
        "/employees",
        values,
      ),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      reset();
      onOpenChange(false);
      onCreated(result.credentials);
    },
    onError: (err) => {
      toast({
        variant: "danger",
        title: "Could not create employee",
        description: err instanceof ApiClientError ? err.message : "Something went wrong.",
      });
    },
  });

  const departmentId = watch("departmentId");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>New employee</SheetTitle>
        </SheetHeader>
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-1 flex-col gap-4 overflow-y-auto"
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" {...register("firstName")} />
              {errors.firstName ? (
                <p className="text-danger text-xs">{errors.firstName.message}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...register("lastName")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email ? <p className="text-danger text-xs">{errors.email.message}</p> : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" {...register("phone")} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="jobTitle">Job title</Label>
            <Input id="jobTitle" {...register("jobTitle")} />
            {errors.jobTitle ? (
              <p className="text-danger text-xs">{errors.jobTitle.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Department</Label>
            <Select
              value={departmentId ?? undefined}
              onValueChange={(v) => setValue("departmentId", v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="No department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="joinedOn">Joining date</Label>
            <Input id="joinedOn" type="date" {...register("joinedOn")} />
            {errors.joinedOn ? (
              <p className="text-danger text-xs">{errors.joinedOn.message}</p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              defaultValue="EMPLOYEE"
              onValueChange={(v) => setValue("role", v as CreateEmployeeInput["role"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="HR">HR Officer</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <SheetFooter>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create employee"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function CredentialsDialog({
  credentials,
  onClose,
}: {
  credentials: NewEmployeeCredentials | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!credentials) return;
    await navigator.clipboard.writeText(
      `Login ID: ${credentials.loginId}\nPassword: ${credentials.temporaryPassword}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={!!credentials} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Employee created</DialogTitle>
        </DialogHeader>
        {credentials ? (
          <div className="space-y-3">
            <p className="text-ink-500 text-sm">
              Credentials have been emailed to {credentials.email}. They're also shown here{" "}
              <strong>exactly once</strong> — copy them now if you need them.
            </p>
            <div className="bg-ink-100 rounded-card space-y-1 p-3 font-mono text-sm">
              <p>
                Login ID: <span className="tabular font-semibold">{credentials.loginId}</span>
              </p>
              <p>
                Password:{" "}
                <span className="tabular font-semibold">{credentials.temporaryPassword}</span>
              </p>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="secondary" onClick={copy}>
            {copied ? (
              <>
                <Check className="h-4 w-4" aria-hidden="true" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" aria-hidden="true" /> Copy
              </>
            )}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

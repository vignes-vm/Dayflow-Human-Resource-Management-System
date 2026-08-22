import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import type { PrivateInfoResponse } from "@dayflow/shared";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ErrorState";
import { api } from "@/lib/api";

type FormState = {
  dateOfBirth: string;
  nationality: string;
  personalEmail: string;
  gender: string;
  maritalStatus: string;
  bankAccountNumber: string;
  bankName: string;
  ifscCode: string;
  panNumber: string;
  uanNumber: string;
  employeeCode: string;
};

const EMPTY: FormState = {
  dateOfBirth: "",
  nationality: "",
  personalEmail: "",
  gender: "",
  maritalStatus: "",
  bankAccountNumber: "",
  bankName: "",
  ifscCode: "",
  panNumber: "",
  uanNumber: "",
  employeeCode: "",
};

function toForm(data: PrivateInfoResponse): FormState {
  return {
    dateOfBirth: data.dateOfBirth ? format(new Date(data.dateOfBirth), "yyyy-MM-dd") : "",
    nationality: data.nationality ?? "",
    personalEmail: data.personalEmail ?? "",
    gender: data.gender ?? "",
    maritalStatus: data.maritalStatus ?? "",
    bankAccountNumber: data.bankAccountNumber ?? "",
    bankName: data.bankName ?? "",
    ifscCode: data.ifscCode ?? "",
    panNumber: data.panNumber ?? "",
    uanNumber: data.uanNumber ?? "",
    employeeCode: data.employeeCode ?? "",
  };
}

export function PrivateInfoTab({
  employeeId,
  editable,
}: {
  employeeId: string;
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["private-info", employeeId],
    queryFn: () => api.get<PrivateInfoResponse>(`/profile/${employeeId}/private-info`),
  });

  const [form, setForm] = useState<FormState>(EMPTY);
  const [revealAccount, setRevealAccount] = useState(false);

  useEffect(() => {
    if (query.data) setForm(toForm(query.data));
  }, [query.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/profile/${employeeId}/private-info`, {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        gender: form.gender || null,
        maritalStatus: form.maritalStatus || null,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["private-info", employeeId] }),
  });

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
    onBlur: () => editable && saveMutation.mutate(),
    disabled: !editable,
  });

  const maskedAccount =
    !revealAccount && form.bankAccountNumber
      ? `••••${form.bankAccountNumber.slice(-4)}`
      : form.bankAccountNumber;

  if (query.isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="dob">Date of birth</Label>
        <Input id="dob" type="date" {...field("dateOfBirth")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="nationality">Nationality</Label>
        <Input id="nationality" {...field("nationality")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="personalEmail">Personal email</Label>
        <Input id="personalEmail" type="email" {...field("personalEmail")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="gender">Gender</Label>
        <Input id="gender" placeholder="Male / Female / Other" {...field("gender")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="maritalStatus">Marital status</Label>
        <Input id="maritalStatus" {...field("maritalStatus")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="employeeCode">Employee code</Label>
        <Input id="employeeCode" {...field("employeeCode")} />
      </div>

      <div className="sm:col-span-2">
        <p className="text-ink-500 mb-2 mt-2 text-xs font-semibold uppercase tracking-wide">
          Bank details
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bankAccountNumber">Account number</Label>
        <div className="flex gap-2">
          <Input
            id="bankAccountNumber"
            value={maskedAccount}
            onChange={field("bankAccountNumber").onChange}
            onBlur={field("bankAccountNumber").onBlur}
            disabled={!editable || !revealAccount}
          />
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => setRevealAccount((v) => !v)}
            aria-label={revealAccount ? "Hide account number" : "Reveal account number"}
          >
            {revealAccount ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="bankName">Bank name</Label>
        <Input id="bankName" {...field("bankName")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ifscCode">IFSC code</Label>
        <Input id="ifscCode" {...field("ifscCode")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="panNumber">PAN</Label>
        <Input id="panNumber" {...field("panNumber")} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="uanNumber">UAN</Label>
        <Input id="uanNumber" {...field("uanNumber")} />
      </div>
    </div>
  );
}

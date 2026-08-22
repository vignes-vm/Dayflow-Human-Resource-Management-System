// One key builder per domain, namespaced so a domain owner never collides with
// another's cache entries. Add new domains here — never inline ad-hoc keys.
export const queryKeys = {
  me: () => ["me"] as const,
  company: () => ["company"] as const,
  holidays: (year?: number) => ["holidays", year] as const,
  loginIdPreview: () => ["settings", "login-id-preview"] as const,
  notifications: (page?: number) => ["notifications", page] as const,
  audit: (filters: Record<string, unknown>) => ["audit", filters] as const,
  employees: (filters?: Record<string, unknown>) => ["employees", filters] as const,
  employee: (id: string) => ["employees", id] as const,
  departments: () => ["departments"] as const,
  attendance: (filters?: Record<string, unknown>) => ["attendance", filters] as const,
  timeOff: (filters?: Record<string, unknown>) => ["time-off", filters] as const,
  payroll: (filters?: Record<string, unknown>) => ["payroll", filters] as const,
  analytics: (filters?: Record<string, unknown>) => ["analytics", filters] as const,
};

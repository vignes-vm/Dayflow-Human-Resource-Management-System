import type { Role } from "@dayflow/shared";

// Every top-bar nav item, declared once. M2 ONLY — see
// docs/Dayflow-Team-Plan.md §3.3. Feature owners build the page their route
// already points to; nobody adds or edits nav items here except M2.
export interface NavItem {
  label: string;
  path: string;
  roles?: Role[];
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Employees", path: "/employees" },
  { label: "Attendance", path: "/attendance" },
  { label: "Time Off", path: "/time-off" },
  { label: "Payroll", path: "/payroll" },
  { label: "Settings", path: "/settings", roles: ["ADMIN"] },
];

// Audit Log (S20) is deliberately not a top-bar tab — the board's S6 mock
// only names five centre tabs. It's reachable from within Settings instead.

export function navItemsForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(role));
}

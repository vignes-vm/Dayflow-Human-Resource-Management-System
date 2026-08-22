# Dayflow — Claude Code build prompts **v2**
**21 steps, reconciled against the wireframe board. Each step ends with a commit and a push.**

> Use these with `docs/Dayflow-Blueprint-v2.md`. Discard the v1 prompts — Steps 4, 7, 8, 9, 12, 13, 14 and 15 have changed substantially.

---

## Before you start

```bash
mkdir dayflow && cd dayflow
git init -b main
git remote add origin https://github.com/<your-org>/dayflow.git
mkdir -p docs
cp /path/to/Dayflow-Blueprint-v2.md docs/
cp /path/to/Dayflow-ClaudeCode-Prompts-v2.md docs/
cp /path/to/wireframes.png docs/           # the Excalidraw export — Claude Code can read it
claude
```

### Rules for every step
1. Paste the prompt exactly. Each references `docs/Dayflow-Blueprint-v2.md` — Claude Code will read it for detail.
2. **Run the acceptance checks before committing.** A red check means `Fix: <what failed>`, not "next step".
3. Commit and push with the block given. Clean per-feature history is itself a judging signal.
4. If output drifts: `Re-read docs/Dayflow-Blueprint-v2.md §<n> and correct the implementation to match it exactly.`
5. Point Claude Code at `docs/wireframes.png` whenever you're building a screen — say `Compare your output against docs/wireframes.png and list every deviation before fixing them.`

---

# Step 1 — Repository, tooling, CLAUDE.md

> **Prompt**
>
> Read `docs/Dayflow-Blueprint-v2.md` in full and look at `docs/wireframes.png` before doing anything. Together they are the specification.
>
> Scaffold the monorepo from the Appendix:
> - pnpm workspace with `apps/api`, `apps/web`, `packages/shared`.
> - `apps/web`: Vite + React 18 + TypeScript + Tailwind, alias `@/*` → `src/*`.
> - `apps/api`: Express + TypeScript, `tsx watch` dev, `tsc` build, alias `@/*` → `src/*`, one route `GET /api/v1/health`.
> - `packages/shared`: Zod schemas and inferred types consumed by both apps.
> - Root scripts: `dev` (both apps concurrently), `build`, `lint`, `format`, `typecheck`, `test`.
> - ESLint + Prettier, TypeScript strict, Husky + lint-staged pre-commit.
> - `.gitignore` (node_modules, dist, .env*, uploads, coverage). `.env.example` for both apps documenting every variable: DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ACCESS_TTL, REFRESH_TTL, SMTP_*, MAIL_FROM, APP_URL, API_URL, UPLOAD_DIR, NODE_ENV, PORT.
> - `.github/workflows/ci.yml`: on push and PR to main → install, typecheck, lint, test, build.
> - `README.md` with placeholders for screenshots and demo credentials.
> - `CLAUDE.md` containing the product summary, stack, folder conventions, commit convention, and these standing rules:
>   1. Never put secrets in code.
>   2. All API input validated with Zod schemas from `packages/shared`.
>   3. All multi-write DB operations run inside a transaction.
>   4. Every mutating route writes an AuditLog entry.
>   5. Every list/read query is scoped by `companyId`.
>   6. **All money and percentage arithmetic uses `decimal.js`. Never JavaScript floats.**
>   7. Business rules live as pure functions in `apps/api/src/engines/` with unit tests and no DB access.
>   8. Every new screen ships with loading, empty and error states.
>   9. All colours and fonts come from the token file — never a hardcoded hex.
>
> Verify `pnpm install`, `pnpm typecheck` and `pnpm build` pass.

**Checks:** install/typecheck/build pass · `pnpm dev` starts both · `/api/v1/health` returns ok · `.env` gitignored · CLAUDE.md has all nine rules

```bash
git add -A
git commit -m "chore: scaffold pnpm monorepo, tooling, CI and CLAUDE.md"
git push -u origin main
```

---

# Step 2 — Database schema

> **Prompt**
>
> Implement the complete Prisma schema in `apps/api/prisma/schema.prisma` exactly matching §7 of `docs/Dayflow-Blueprint-v2.md`: Company, User, Employee, PrivateInfo, Resume, Skill, Certification, Department, AttendanceRecord, AttendanceSession, TimeOffType, TimeOffAllocation, TimeOffRequest, Contract, SalaryComponent, Payslip, PayslipLine, Holiday, Document, Notification, AuditLog, Setting, RefreshToken, EmailToken.
>
> Requirements:
> - Postgres. Every tenant-owned model carries `companyId`.
> - Unique: `User.loginId`, `User.email`, `Company.name`, `AttendanceRecord(employeeId, date)`, `Payslip(employeeId, month, year)`, `Contract(employeeId, effectiveFrom)`, `SalaryComponent(contractId, code)`, `Setting(companyId, key)`.
> - A `LoginIdCounter` model keyed on `(companyId, year)` with a `lastSerial` integer, for race-safe serial allocation.
> - Indexes per §7.
> - All money as `Decimal @db.Decimal(12,2)`; component `value` as `Decimal(9,4)`; time-off `days` as `Decimal(5,1)`.
> - `Employee.managerId` self-relation. Cascade only on tokens and sessions — never on payslips or audit logs.
> - `createdAt` / `updatedAt` everywhere.
>
> Then create `src/lib/prisma.ts` as a singleton **with a client extension that injects `companyId` scoping on findMany/findFirst for tenant models** — document how to bypass it deliberately for the few places that need to. Add `src/lib/money.ts` wrapping `decimal.js` with `add`, `sub`, `mul`, `pctOf`, `round2` (half-up) and a `toDisplay` formatter.
>
> Run the initial migration. Add `db:migrate`, `db:reset`, `db:studio`, `db:seed` scripts. Write `docs/ERD.md` with a mermaid diagram matching the final schema.

**Checks:** migration runs clean · Studio shows every table · `money.ts` has unit tests proving `pctOf(50000, 8.33)` rounds correctly · ERD matches the schema field for field

```bash
git add -A
git commit -m "feat(db): full Prisma schema, company scoping and decimal money helpers"
git push
```

---

# Step 3 — Design system

> **Prompt**
>
> Implement the Dayflow design system in `apps/web` per §12 of `docs/Dayflow-Blueprint-v2.md`.
>
> 1. `src/styles/tokens.css` with every CSS variable in §12 plus a `[data-theme="dark"]` block.
> 2. Wire tokens into `tailwind.config.ts` as semantic names (`bg-paper`, `text-ink-700`, `bg-primary-500`, `text-present`, `rounded-card`). Load General Sans (display), Satoshi (body), JetBrains Mono (data) with `font-display: swap` and local fallbacks.
> 3. A `.tabular` utility with `font-variant-numeric: tabular-nums`, applied to the mono face by default.
> 4. Install shadcn/ui and restyle to tokens: Button, Input, Label, Select, Textarea, Dialog, Sheet, DropdownMenu, Tabs, Table, Badge, Avatar, Tooltip, Toast, Skeleton, Card, Calendar, Popover, Switch, Checkbox, RadioGroup.
> 5. Dayflow components in `src/components/`:
>    - `PresenceDot` — states present / on-leave (airplane glyph) / absent / not-checked-in, 10 px with a 2 px surface ring, `title` attribute always set, never colour alone.
>    - `StatusPill`, `StatCard`, `EmptyState`, `ErrorState`, `PageHeader`.
>    - `DataTable` — generic, sortable, paginated, with skeleton and empty states built in. **Numeric columns right-aligned and tabular** — the attendance and salary tables both depend on this.
>    - `MoneyInput` and `PercentInput` — controlled, decimal-safe, no float drift on keystrokes.
> 6. A dev-only `/kitchen-sink` route rendering every component in every state, light and dark.
> 7. `ThemeProvider` with system/light/dark and persistence.
>
> Visible focus ring on every interactive element. No hardcoded hex outside `tokens.css`.

**Checks:** `/kitchen-sink` renders everything, both themes, no console errors · tab through shows focus rings everywhere · `grep -rn "#[0-9a-fA-F]\{6\}" apps/web/src --include=*.tsx` is empty · numerals align in a column

```bash
git add -A
git commit -m "feat(ui): Dayflow design tokens, typography and component library"
git push
```

---

# Step 4 — Auth, Login ID engine, company registration

> ⚠️ **This is the step that changed most from v1.** There is no employee self-registration.

> **Prompt**
>
> Read §8, §9 (Auth) and §10.1–10.2 of `docs/Dayflow-Blueprint-v2.md`, and the top-left panel of `docs/wireframes.png`.
>
> **First, the Login ID engine** — `apps/api/src/engines/loginId.ts`, a pure function with no DB access:
> - `buildLoginId({ companyCode, firstName, lastName, joiningYear, serial, serialWidth })` → uppercase `[CC][FF][LL][YYYY][NNNN]`.
> - Strip non-alphabetic characters before taking initials; right-pad names shorter than two letters with `X`.
> - `deriveCompanyCode(name)` → first two alphabetic characters, uppercased.
> - `generatePassword()` → 12 characters excluding ambiguous glyphs (0/O, 1/l/I), guaranteed to contain upper, lower, digit and symbol.
> - Unit tests: "Odoo India" + "John Doe" + 2023 + 1 → `ODJODO20230001`; "Li Wu" → `LIWU`; "A Kumar" → `AXKU`; names with hyphens and accents.
>
> **Then the auth module** at `apps/api/src/modules/auth`:
> - `POST /auth/register-company` — company name, logo upload, admin name, email, phone, password, confirm. In one transaction: create Company (code derived, editable later), create the ADMIN User with a generated Login ID (serial 0001), seed default TimeOffTypes (Paid 24, Sick 9, Unpaid 0), default Settings (PF 12/12, professional tax 200, work days 5, standard daily hours 8, break 60 min, coverage 70/50, absence cutoff 11:00). Send a verification email.
> - `GET /auth/verify?token` — hashed single-use token, 24 h expiry, activates the admin.
> - `POST /auth/login` — `{ identifier, password }` where identifier matches **Login ID or email**, case-insensitive. Identical `401 INVALID_CREDENTIALS` for unknown identifier and wrong password. `403 EMAIL_NOT_VERIFIED` for unverified admins, `403 ACCOUNT_SUSPENDED` for suspended.
> - `POST /auth/change-password` — clears `mustChangePassword`.
> - `POST /auth/refresh` (rotation with reuse detection — replaying a revoked token kills the whole family), `POST /auth/logout`, `GET /auth/me` returning user + employee + role + `mustChangePassword`.
> - `POST /auth/forgot-password`, `POST /auth/reset-password`.
> - **There is deliberately no public employee registration endpoint.** Employees are created in Step 7.
>
> **Middleware** in `src/middleware/`: `requireAuth`, `requireRole(...)`, `requireCompanyScope`, `assertSelfOrAdmin`, `requirePasswordChanged` (403 `PASSWORD_CHANGE_REQUIRED` on every route except `/auth/me`, `/auth/change-password`, `/auth/logout`), `validate(schema)`, and a global error handler emitting `{ error: { code, message, field } }`.
>
> Mailer at `src/lib/mailer.ts` — Nodemailer with SMTP, Ethereal fallback, branded HTML templates. In development, also return verification and credential URLs in the response body so mail delivery can never block the demo.
>
> Rate limits: login 5 per 15 min per IP, register-company 3 per hour, forgot-password 3 per hour. helmet, CORS allow-list, cookie-parser, request-ID logging.
>
> Tests: company registration creates all seeded defaults · duplicate company name and email rejected · login by Login ID and by email both work · unverified admin blocked · refresh rotation and reuse detection · `mustChangePassword` blocks other routes.

**Checks:** all Login ID unit tests green including edge cases · register company → verify → login by Login ID → `/me` · login by email works too · a user with `mustChangePassword` gets 403 on `/employees` but can reach `/auth/change-password`

```bash
git add -A
git commit -m "feat(auth): company registration, Login ID engine and JWT sessions"
git push
```

---

# Step 5 — Auth screens

> **Prompt**
>
> Build screens S1–S5 from §11 of `docs/Dayflow-Blueprint-v2.md`, matching the top-left panel of `docs/wireframes.png`.
>
> - API client (`src/lib/api.ts`) with `credentials: "include"`, typed helper, one-shot refresh-and-retry on 401. TanStack Query provider. React Hook Form + zodResolver. Router with public and protected groups.
> - **S1 Sign In** — App/Web logo, a single "Login ID / Email" field, password with show/hide, Sign In, "Don't have an Account? Sign Up". Distinct copy per error code. On success route to `/employees`, or to `/change-password` when `mustChangePassword`.
> - **S2 Sign Up** — exactly the board's field order: Company Name with a logo upload button beside it, Name, Email, Phone, Password, Confirm Password, both with eye toggles. Live password strength meter and a match indicator on confirm. Below the form, the explanatory line from §11: *"Signing up creates your company. You'll add your team from inside Dayflow — we generate their Login IDs and passwords automatically."*
> - **S3 Verify result** — success (auto-redirect after 3 s), expired (resend), already used.
> - **S4 Forgot / reset password.**
> - **S5 Forced change password** — shown when `mustChangePassword`; explains why, lists the rules, and cannot be dismissed or routed away from.
> - `useAuth()` from `/auth/me`; `<ProtectedRoute>` and `<RoleRoute>` showing a skeleton while loading rather than flashing the login page.
> - A small "Demo accounts" box on Sign In (placeholder text until Step 20).
>
> Every form: disabled submit while pending, inline field errors mapped from `error.field`, toast on failure, full keyboard operability, responsive to 360 px.

**Checks:** register company → verify → sign in → land on Employees · signing in as the seeded `mustChangePassword` user forces the change screen and blocks navigation · each auth error shows its own message · refresh keeps you signed in with no login flash

```bash
git add -A
git commit -m "feat(web): sign in, company sign up and forced password change"
git push
```

---

# Step 6 — App shell

> **Prompt**
>
> Build screen S6 from §11 of `docs/Dayflow-Blueprint-v2.md`, matching the top bar in `docs/wireframes.png`. **This is a top-tab shell, not a sidebar.**
>
> - Top bar: company logo left. Centre tabs — **Employees · Attendance · Time Off**, plus **Payroll** and **Settings** for Admin. Active tab clearly marked.
> - Right cluster, in this order: the **PresenceDot** for the current user, the **Check In → / Check Out →** systray control, and the avatar with a dropdown containing exactly **My Profile** and **Log Out** as annotated.
> - The check-in control is a live button: label and colour reflect current state, it shows the running work time once checked in, and it is disabled with an explanatory tooltip on holidays and approved leave days. Wire it to stubs for now — Step 10 supplies the API.
> - Below 1024 px: tabs collapse to a bottom bar with the check-in control raised in the centre.
> - Route-level code splitting with a shell-shaped skeleton fallback. Global toast host. 404, 403 ("You don't have access to this" plus a link onward), and an offline banner.
> - Page transition: 200 ms fade + 4 px rise, behind `useReducedMotion`.
> - Command palette on `⌘K`: navigate to any tab, plus "Check in", "Request time off", "Search employees". Fuzzy match, keyboard-only. *(Cuttable — see §15.)*

**Checks:** tabs differ correctly between admin, HR and employee · avatar dropdown has exactly the two annotated items · presence dot and check-in control render in the top-right · at 375 px the bottom bar appears with no horizontal overflow · an employee hitting an admin route sees the 403 page

```bash
git add -A
git commit -m "feat(web): top-tab app shell, systray check-in control and presence dot"
git push
```

---

# Step 7 — Employees API and grid (the landing page)

> **Prompt**
>
> Read §9 (Employees), §10.1 and §11 (S7) of `docs/Dayflow-Blueprint-v2.md`, and the second panel of `docs/wireframes.png`.
>
> **Backend** — `apps/api/src/modules/employees`:
> - `GET /employees?search&department&presence&page` — every authenticated role can list. Returns the card payload: id, name, avatar, job title, department, and **live presence** computed per §10.3 (`GREEN` open session today, `AIRPLANE` approved time off covering today, `YELLOW` past the company's absence cutoff with no session and no leave, `RED` before cutoff and not yet checked in). **Compute presence for the whole page in one query set — no N+1.**
> - `POST /employees` — ADMIN/HR only. Body: first name, last name, email, phone, department, job title, manager, joining date, role, work location. In **one transaction**: allocate the serial from `LoginIdCounter` for (company, joining year) with row-level locking, build the Login ID via the engine, generate the first password, hash it, create User (`mustChangePassword = true`) + Employee + empty Resume + empty PrivateInfo + default TimeOffAllocations from each type's default. Email the credentials. Return the Login ID and the plaintext password **exactly once** in the response.
> - `GET /employees/:id` — role-shaped payload: full for self and ADMIN/HR; **view-only** for anyone else, with salary, private info and security data omitted server-side, not just hidden in the UI.
> - `GET /departments`, `POST`, `PATCH` — read for all, write for ADMIN.
> - `GET /attendance/presence` — the same presence computation, for polling and SSE refresh.
>
> Tests: two parallel `POST /employees` calls produce distinct sequential Login IDs · an employee fetching another employee's record receives no salary or private-info fields · an employee cannot POST `/employees` (403) · a second company's admin sees none of this company's employees.
>
> **Frontend** — **S7 Employees page**, the landing route for every role:
> - Card grid per the wireframe: avatar, name, job title and department, with the **PresenceDot top-right of each card**. Cards are clickable → the employee profile in view-only mode.
> - **NEW** button (ADMIN/HR only) opens a create drawer. On success show a one-time credentials panel with the Login ID and password, a copy button, and the warning that the password is shown only once.
> - Search plus department and presence filters, URL-persisted. Skeleton cards on load, empty state with a Clear filters action, error state with retry.
> - Cards stagger in at 40 ms each, behind `useReducedMotion`.

**Checks:** the grid is the landing page for all three roles · dots render correctly for a checked-in, on-leave, absent and not-yet-checked-in seed employee · creating an employee shows credentials once and emails them · clicking a card opens view-only · parallel creation test green

```bash
git add -A
git commit -m "feat: employee directory with live presence and admin-created accounts"
git push
```

---

# Step 8 — Profile tabs

> **Prompt**
>
> Build screen S8 from §11 of `docs/Dayflow-Blueprint-v2.md` and the profile mockups in `docs/wireframes.png`. **Do not build the Salary Info tab in this step — that is Step 9.**
>
> **Backend** — `GET/PUT /employees/:id/private-info`, `GET/PUT /employees/:id/resume`, skills and certifications CRUD, `POST /employees/:id/avatar` and `/documents` (Multer, 5 MB cap, MIME allow-list, server-generated filenames). Two Zod schemas for employee PATCH — `selfUpdateSchema` (phone, avatar, resume content, private info) and `adminUpdateSchema` (all fields); pick by role and never trust a client-sent role. Store only the last four digits of any Aadhaar number. Every mutation audited with before/after.
>
> **Frontend:**
> - Header per the board: avatar, name, then two field columns — Login ID, Email, Mobile | Company, Department, Manager, Location.
> - Tabs: **Resume · Private Info · Salary Info · Security**. Salary Info renders as a placeholder for now, and is **absent from the tab strip entirely** for HR and Employee roles.
> - *Resume* — About, What I love about my job, My interests and hobbies as rich text on the left; Skills and Certifications with "+ Add" chips on the right, each removable.
> - *Private Info* — date of birth, nationality, personal email, gender, marital status, date of joining; a Bank Details block with account number, bank name, IFSC, PAN, UAN, employee code. Mask the account number by default with a reveal toggle.
> - *Security* — change password, last login, active sessions with a revoke action.
> - **View-only mode** when viewing someone else: Salary Info and Security absent, every field plain text, a "Viewing <name>'s profile" bar with Back.
> - **My Profile** mode: editable whitelist only; locked fields show a lock icon with the tooltip "Contact HR to change this."
> - **Employee switcher** in the header — `←` `→` arrows plus a searchable dropdown, keyboard `[` and `]`, preserving the active tab (SRS 3.2.2).
> - Avatar upload with crop and optimistic preview; changing it updates the top bar immediately.

**Checks:** an employee sees job fields locked and salary/security tabs absent on others' profiles · an admin sees everything · the switcher keeps the active tab · a `PUT /private-info` for another employee returns 403 · bank account is masked until revealed

```bash
git add -A
git commit -m "feat: employee profile with resume, private info and security tabs"
git push
```

---

# Step 9 — Salary component engine and Salary Info tab

> ⚠️ **The hardest step here, and the biggest differentiator. Build the engine and its tests before any UI. Timebox to four hours; if it slips, see the fallback in §15.**

> **Prompt**
>
> Read §3.2, §7 (Contract, SalaryComponent), §10.5 and §11 (S9) of `docs/Dayflow-Blueprint-v2.md`, and the "Important" note and Salary Info mockup in `docs/wireframes.png`.
>
> **Part A — the engine.** `apps/api/src/engines/salaryComponents.ts`, a pure function with no DB access, using `decimal.js` throughout:
>
> `computeContract({ monthlyWage, components, pfRateEmployee, pfRateEmployer, professionalTax })` → `{ lines, totals, errors }`
>
> - Component computations: `FIXED` → the value; `PCT_OF_WAGE` → wage × value%; `PCT_OF_COMPONENT` → the named base component's computed amount × value%; `BALANCE` → wage − Σ all other EARNING components.
> - Build the dependency graph from `baseComponentCode` and evaluate in topological order. Detect cycles and return `CIRCULAR_COMPONENT_REFERENCE` naming the cycle.
> - Exactly one `BALANCE` component per contract. If Σ non-balance earnings exceeds the wage, return `COMPONENTS_EXCEED_WAGE` with the overflow amount — never a negative balance.
> - Deductions: PF employee = pfRate% of Basic, PF employer = pfRate% of Basic (categorised `EMPLOYER_CONTRIBUTION`, excluded from the employee's net), Professional Tax as a flat amount. Rates come from company Settings, never hardcoded.
> - Round half-up to 2 dp **only at the output boundary**; carry full precision internally.
> - `defaultComponentSet()` returning the board's six earnings — Basic 50% of wage, HRA 50% of Basic, Standard Allowance fixed 4567, Performance Bonus 8.33% of Basic, LTA 8.33% of Basic, Fixed Allowance BALANCE — plus the three deduction/contribution lines.
>
> Unit tests, and these exact cases must pass:
> - Wage 50,000 with the default set → Basic 25,000 · HRA 12,500 · Standard 4,567 · Bonus 2,082.50 · LTA 2,082.50 · Fixed Allowance 3,768.00 · **earnings total exactly 50,000**.
> - Wage 60,000 with the same set → every dependent value scales and the total is exactly 60,000.
> - PF employee and employer both 3,000 at wage 50,000 with a 12% rate.
> - A component set summing above the wage returns `COMPONENTS_EXCEED_WAGE` with the correct overflow.
> - A → B → A returns `CIRCULAR_COMPONENT_REFERENCE`.
> - No result ever contains a floating-point artefact such as `2082.4999999`.
>
> **Part B — the API.** `POST /contracts/preview` (ADMIN) computes and returns the full breakdown **without writing**. `POST /contracts` inserts a **new effective-dated Contract** plus its SalaryComponent rows, never mutating an existing one, validating that `effectiveFrom` is not before the joining date and that no contract already exists for that date, and auditing with the previous contract as `before`. `GET /contracts?employeeId` returns full history for ADMIN, current only for the owner.
>
> **Part C — the UI.** The Salary Info tab, matching the board's layout exactly: Month Wage and Yearly wage (each derived from the other), working days per week, break time in hours; then the components table with amount, `₹/month`, and the computation control per row; then Provident Fund and Tax Deductions blocks; then an effective-from date and Save.
> - **Every amount recomputes live** as the wage or any percentage changes, debounced 300 ms against `/contracts/preview`, with a subtle pending state on the amounts only — never a blocking spinner.
> - A totals row shows earnings against the wage with a ✓ when they match; on overflow it turns `--absent` and names the excess in words.
> - Admin-only, enforced server-side as well as in the tab strip.
> - Below, a history list of previous contracts with effective dates, author and a diff against the prior one.

**Checks:** every listed engine test green · typing 60000 into Month Wage updates all six components and the total lands exactly on 60,000 · yearly wage stays in sync both directions · setting Standard Allowance to 60,000 blocks Save with the overflow named · HR and Employee accounts cannot see the tab, and `GET /contracts` for them returns 403 · saving creates a new contract row, leaving the old one intact

```bash
git add -A
git commit -m "feat: salary component engine with live computation and effective-dated contracts"
git push
```

---

# Step 10 — Attendance API

> **Prompt**
>
> Implement `apps/api/src/modules/attendance` per §9, §10.3 and the attendance note in `docs/wireframes.png`.
>
> - `apps/api/src/engines/attendanceStatus.ts` — pure functions: `deriveStatus({ workMinutes, standardDailyMinutes, hasApprovedLeave, isHoliday, isWorkingDay })` per the §10.3 table; `computeMinutes(sessions, standardDailyMinutes)` → `{ workMinutes, breakMinutes, extraMinutes }` where breaks are the gaps between consecutive sessions and `extraMinutes = max(0, work − standard)`. Unit tests at every threshold boundary and for one, two and four sessions.
> - `POST /attendance/check-in` — self only. `409 ALREADY_CHECKED_IN` if a session is open. Creates today's record if absent, opens a session.
> - `POST /attendance/check-out` — self only. `409 NOT_CHECKED_IN` if none open. Closes the session, recomputes minutes.
> - `GET /attendance/me?month` — day-wise for the month, current month by default, with sessions nested and work/break/extra per day.
> - `GET /attendance/day?date&departmentId` — ADMIN/HR, every employee for one day, sorted by department then name.
> - `GET /attendance/summary?employeeId&month` — **days present, leaves count, total working days** (the three figures in the board's employee header), plus total hours and total extra hours.
> - `PATCH /attendance/:id` — ADMIN/HR regularisation: edit session times, change status, **`reason` required**, sets `source=ADMIN`, `editedById`, `editedAt`, writes an audit entry.
> - **Daily close job** — node-cron 23:59 plus an admin-triggerable route for the demo: close open sessions flagged `MISSED_CHECKOUT`, derive and persist status for every employee, mark weekends and holidays, mark ABSENT where due. **Idempotent — running twice changes nothing.**
> - All date arithmetic in `src/lib/dates.ts` using the company timezone from Settings. No scattered `new Date()` maths.
>
> Tests: double check-in rejected · check-out without check-in rejected · multi-session minutes and break maths · extra-hours calculation · every status threshold · daily close idempotency · an employee cannot read another's attendance.

**Checks:** all engine tests green · check in, out, in again → two sessions, break counted between them, minutes summed · a 9.5-hour day yields 1.5 extra hours · running daily close twice is a no-op · `GET /attendance/day` as an employee returns 403

```bash
git add -A
git commit -m "feat(api): attendance sessions, break and extra-hours computation, daily close"
git push
```

---

# Step 11 — Attendance screens

> **Prompt**
>
> Build screens S10 and S11 from §11 of `docs/Dayflow-Blueprint-v2.md`, matching the third panel of `docs/wireframes.png`. **The table is the default view** — match the board first, then add the ribbon as a toggle.
>
> - **S10 My attendance (employee)** — header strip showing **Count of days present · Leaves count · Total working days**, and the `Out ∨` status control. Below, the day-wise table for the current month: **Date · Check In · Check Out · Work Hours · Extra Hours**, all numeric columns tabular and right-aligned. Month navigation. Expanding a row shows the individual sessions and break time. Status pill per row.
> - **S11 Attendance (Admin/HR)** — `← →` date navigation with the **Date ∨ / Day** toggle and the date as a heading, plus search. Table of every employee for that day: **Emp · Check In · Check Out · Work Hours · Extra Hours**. Row click opens the regularisation drawer — editable in/out times, status select, required reason, save. Export CSV for the visible range.
> - Wire the systray Check In / Check Out control from Step 6 to the real endpoints: optimistic update, a live-ticking work timer, rollback with an error toast on failure, and **the presence dot turning green on success** as the board annotates. Invalidate the employee grid so other users' views update.
> - **`DayRibbon` component** and a view toggle on both screens. Props `{ date, status, sessions, expectedStart, expectedEnd, editedBy? }`; renders a horizontal track over the day window with filled worked segments, hollow break gaps, status colouring, hour ticks, check-in/out markers, a hatch overlay on admin-edited days naming the editor, and a gentle pulse on an in-progress session. Segments animate 0 → n% over 320 ms, staggered 40 ms when stacked, behind `useReducedMotion`. Add a compact variant to the employee cards from Step 7. Add every state to `/kitchen-sink`.
> - Skeleton rows, empty states, error states throughout.

**Checks:** the employee table matches the board's five columns and the header's three counts · admin date navigation and the Date/Day toggle work · regularising updates the row, adds the hatch and writes an audit entry · check-in from the systray turns the dot green and starts the timer · usable at 375 px

```bash
git add -A
git commit -m "feat(web): attendance tables, regularisation and Day Ribbon view"
git push
```

---

# Step 12 — Time off API and allocations

> **Prompt**
>
> Implement `apps/api/src/modules/timeoff` per §9, §10.4 and the fourth panel of `docs/wireframes.png`.
>
> - Time off types: Paid Time Off, Sick Leave, Unpaid Leave. `requiresAttachment` true for Sick. Admin CRUD with default allocation days.
> - **Allocations** — `GET /time-off/allocations?employeeId`, `POST` (single or bulk by department), `PATCH`, `POST /:id/approve`. Fields: employee, type, days, validity period, note, status.
> - **Balances** — `GET /time-off/balances?employeeId` returning per type `{ allocated, used, pending, remaining }` where `remaining = Σ approved allocations − Σ approved requests − Σ pending requests`. One query, no loops.
> - `apps/api/src/engines/workingDays.ts` — pure: expand a date range, drop non-working weekdays and holidays, apply half-day flags, return `{ days, excludedDates: [{date, reason}] }`. Unit tests including a range that is entirely holidays (→ `ZERO_WORKING_DAYS`).
> - `POST /time-off/requests/preview` — returns working days, excluded dates, balance after, and warnings. No writes.
> - `POST /time-off/requests` — re-validates everything server-side. Typed errors: `INSUFFICIENT_BALANCE`, `OVERLAPPING_REQUEST`, `ATTACHMENT_REQUIRED`, `PAST_DATE_NOT_ALLOWED`, `ZERO_WORKING_DAYS`. Unpaid types skip the balance check but not the overlap check. Status `TO_APPROVE`. Notifies admin and HR.
> - `POST /time-off/:id/decide` — ADMIN/HR, `{ decision, comment }`, comment required on reject. In **one transaction**: set status, decidedBy, decidedAt; on approve upsert an `ON_LEAVE` AttendanceRecord for every covered working day. Guard the race with `updateMany where status = TO_APPROVE` and assert the count is 1.
> - `POST /time-off/:id/cancel` — owner while `TO_APPROVE`, or admin any time; reverses the attendance rows.
> - `GET /time-off/requests/calendar?year` — a compact per-day map for the year grid.
> - Holidays CRUD (admin write).
> - Every decision audited and notified.
>
> Tests: holiday-aware counting · half-day counting to `.5` · insufficient balance · overlapping request · sick leave without an attachment rejected · approve twice fails cleanly with no balance corruption · approval creates exactly the right `ON_LEAVE` rows · cancel restores everything · unpaid bypasses balance but not overlap.

**Checks:** all engine and integration tests green · a 3-day range containing one holiday previews as 2 days · double-approve test green · balances reflect allocations minus approved minus pending

```bash
git add -A
git commit -m "feat(api): time off types, allocations, balances and transactional decisions"
git push
```

---

# Step 13 — Employee time off screens

> **Prompt**
>
> Build screens S14 and S15 from §11 of `docs/Dayflow-Blueprint-v2.md`, matching the "For Employees View" mockup in `docs/wireframes.png`.
>
> - **S14 Time Off (employee)** — the **NEW** button, then the two balance headers exactly as the board shows them: *Paid Time Off — 24 Days Available* and *Sick Time Off — 09 Days Available*, driven by real balances. Below, a **full-year calendar grid**: twelve month blocks in a responsive grid, each day cell coloured by time-off type, with weekends and holidays distinguished, and a legend down the right side. Hovering a day shows the request in a tooltip; clicking one opens it. Year navigation. Beneath the calendar, a list of the employee's own requests with status pills, expandable to show the decision comment, and Cancel on pending ones.
> - **S15 Request modal** — the board's fields in the board's order: Employee (read-only for an employee, a picker for admins), Time off Type, Validity Period from and to, Allocation in days, Attachment upload with the hint "(For sick leave certificate)", and **Submit / Discard** buttons.
>   - The Allocation field auto-fills from the computed working days but stays editable for half-days.
>   - Above the buttons, a live three-line summary from `/preview`: working days, any excluded date with its reason, and balance remaining. Debounced, with the pending state on the summary only.
>   - Attachment required and enforced when the type is Sick Leave, with the requirement stated before submit rather than on failure.
>   - Submit is disabled while any blocking validation fails, with the reason stated inline.
> - Optimistic insert into the list and the calendar on submit; balance headers update immediately.
> - Map every typed error code to a specific inline message. No generic failure text anywhere.

**Checks:** the year grid renders 12 months and is readable at 375 px · balance headers match the API · selecting a range with a holiday shows the exclusion and its name before submit · a sick request without an attachment cannot be submitted · submitting updates calendar, list and balances without a refresh

```bash
git add -A
git commit -m "feat(web): year calendar, balance headers and time off request modal"
git push
```

---

# Step 14 — Coverage Radar and admin time off

> **Prompt**
>
> Our headline decision-support feature. Read §3.1 and §11 (S12, S13) of `docs/Dayflow-Blueprint-v2.md` and the "For Admin & HR Officer" mockup in `docs/wireframes.png`. **Match the board's table layout first**, then add the Radar inside it.
>
> **Backend** — `GET /api/v1/time-off/:id/impact` (ADMIN/HR), returning exactly the shape in §3.1:
> - `allocationAfter` for the requester and type.
> - `workingDays` and `excludedDates`.
> - `teamCoverage` — per working day in the range: the requester's team (same department, or same manager where set), headcount, number already away (approved leave plus this request), coverage percentage, and level `ok` / `watch` / `risk` from the Settings thresholds.
> - `collisions` — teammates with approved or pending leave overlapping the range: name, designation, dates, status.
> - `flags` — `SECOND_REQUEST_THIS_MONTH`, `CROSSES_MONTH_END`, `SHORT_NOTICE`, `NO_CERTIFICATE_ATTACHED`, `ADJACENT_TO_HOLIDAY`.
> - `apps/api/src/engines/coverage.ts` holds the level computation as a pure, tested function. The endpoint must be a single efficient query set — **no N+1 over employees or dates.**
>
> **Frontend — S12 Time Off (Admin/HR)**, matching the board:
> - Tabs **Time Off | Allocation**. The two balance headers. Search.
> - Table: **Name · Start Date · End Date · Time off Type · Status**, with the inline red Reject and green Approve buttons on each row, exactly as drawn.
> - **Clicking a row expands it in place** to reveal the Coverage Radar: a horizontal band of day cells each showing date, a coverage bar, the percentage and the level — with an icon and text label so colour is never the sole carrier — then the "Already away" collision list, the flag chips, remaining allocation, the attachment link if present, and a comment field above the same two buttons. Comment required on reject.
> - Bulk approve via row checkboxes. Keyboard: `J`/`K` to move, `A` approve, `R` reject, `Esc` to collapse, with a small key-hints row.
> - Decisions are optimistic — the row updates immediately, rolling back with an error toast on failure.
> - Filters: status, department, date range. Empty state: "No pending requests. You're all caught up."
>
> **S13 Allocation tab** — allocate days to an individual or in bulk to a department: employee(s), type, days, validity period, note. A table of existing allocations showing allocated, used and remaining per employee and type, with edit and revoke.
>
> Add the Coverage Radar to `/kitchen-sink` with three fixtures: all clear, one risk day, heavy collisions.

**Checks:** the table matches the board's five columns and inline buttons · expanding one of the two seeded overlapping requests shows a `risk` day with both collisions · approving updates the employee's balance, calendar and attendance · `J`/`K`/`A`/`R` work without a mouse · approving the same request from two tabs fails cleanly with no balance corruption · allocating days changes the balance headers everywhere

```bash
git add -A
git commit -m "feat: Coverage Radar impact analysis, admin approvals and allocations"
git push
```

---

# Step 15 — Payroll engine and payslips

> **Prompt**
>
> Implement `apps/api/src/modules/payroll` per §3.3, §10.6 and the attendance note in `docs/wireframes.png` — *"attendance data serves as the basis for payslip generation; any unpaid leave or missing attendance days should automatically reduce the number of payable days."*
>
> - `apps/api/src/engines/payslip.ts` — pure, `decimal.js`, no DB:
>   `computePayslip({ monthlyWage, componentLines, totalWorkingDays, unpaidLeaveDays, missingAttendanceDays, pfRateEmployee, professionalTax })` → `{ payableDays, perDayRate, lossOfPay, grossEarnings, totalDeductions, netPay, lines }` following §3.3 exactly. Unit tests: a full month with no absence; two unpaid leave days; one missing attendance day; a month where absences exceed working days (must clamp at zero, never negative); per-day rate rounding.
> - `POST /payroll/run` — ADMIN, `{ month, year }`. Per active employee: resolve the Contract with the latest `effectiveFrom` ≤ month end (flag `NO_CONTRACT` and skip if none); compute total working days from the calendar minus weekends and holidays; count unpaid leave days from approved UNPAID requests and missing attendance days from ABSENT records with no covering leave; run the engine; upsert a **DRAFT** Payslip with **frozen PayslipLine rows**. Idempotent on (employee, month, year). Return the draft table plus an `anomalies` array (`NO_CONTRACT`, `ZERO_PAYABLE_DAYS`, `NET_NOT_POSITIVE`, `HIGH_LOP`).
> - `POST /payroll/publish` — flips DRAFT → PUBLISHED, renders a PDF per payslip, stores the URL, notifies and emails. Refuses while unresolved anomalies remain unless `force: true`.
> - `GET /payslips?employeeId&year` and `GET /payslips/:id/pdf` — self or ADMIN, streamed with a sensible filename.
> - **Published payslips are frozen.** Never recompute one from live components — always render from its stored `PayslipLine` rows.
> - PDF service (`src/lib/pdf.ts`, PDFKit): company logo and header from Settings; employee block with name, Login ID, designation, department, bank details; pay period; total working days, payable days, LOP days; an earnings table and a deductions table itemised from the frozen lines; gross, total deductions, net; net in words; and a "system generated, no signature required" footer. Dayflow palette. Deterministic layout with no overlap on long values.
>
> Tests: structure resolution picks the correct contract when several exist · LOP maths for two unpaid days · re-running a month does not duplicate payslips · a new contract does not alter a published payslip · an employee cannot fetch another's PDF.

**Checks:** all engine tests green · running payroll twice leaves the row count unchanged · marking one attendance day absent and re-running drops payable days by one and reduces net by exactly the per-day rate · the PDF's figures match the API response exactly · adding a new contract leaves historic payslips untouched

```bash
git add -A
git commit -m "feat(api): attendance-driven payroll run, LOP computation and payslip PDFs"
git push
```

---

# Step 16 — Payroll screens

> **Prompt**
>
> Build screens S16 and S17 from §11 of `docs/Dayflow-Blueprint-v2.md`.
>
> - **S16 Payroll console (Admin)** — employee list with current monthly wage, last payslip month and status. "Run payroll" opens a month picker, then a draft table: employee, total working days, payable days, unpaid leave days, LOP, gross, deductions, net. Anomaly rows flagged in `--absent` and explained in words, each linking to the screen that fixes it (attendance or the Salary Info tab). Nothing is editable here. Publish is a separate deliberate action behind a confirm dialog naming how many payslips will be sent. Export the run as CSV.
> - **S17 My payslips (Employee, read-only)** — a banner reading "Your salary is managed by HR" rather than disabled-looking inputs; the current earnings breakdown as two columns, earnings and deductions, with gross → deductions → net in the display face and tabular numerals; then payslips grouped by year with month, net pay, status and Download PDF. Empty state before the first run.
> - Currency formatting through one shared helper. Never a raw number on screen.

**Checks:** an employee sees no editable control anywhere in payroll · the draft table matches the PDF exactly · publishing shows the count and the employee immediately sees the payslip · the anomaly links land on the right screens

```bash
git add -A
git commit -m "feat(web): payroll console with draft review and employee payslip view"
git push
```

---

# Step 17 — Notifications, email and realtime

> **Prompt**
>
> Implement the notification pipeline per §9 (Platform) of `docs/Dayflow-Blueprint-v2.md`.
>
> - A `notify()` service taking `{ userIds, type, title, body, link, email? }` that writes Notification rows, pushes over SSE, and optionally queues an email.
> - Triggers: employee created (credentials to them, confirmation to the admin) · time off submitted (manager + HR) · approved or refused (employee) · allocation granted (employee) · attendance regularised (employee) · payslip published (employee) · contract changed (employee).
> - `GET /api/v1/stream` — authenticated SSE keyed by user, heartbeat every 25 s, clean disconnect, a registry that survives multiple tabs.
> - `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`.
> - Email templates on a shared branded layout: company verification, **employee credentials (Login ID + first password + change-on-first-login instruction)**, password reset, time off decision, payslip ready. All plain-text-safe.
> - **Frontend**: `useSSE()` connecting on sign-in with backoff reconnect, invalidating the right TanStack Query keys per event type — in particular, a check-in event must refresh the **employee grid presence dots** for everyone. A notification bell with unread count, a dropdown with relative times and click-through, mark-all-read, and a toast for events arriving while focused.
>
> Then verify the SRS 3.5.2 "reflects immediately" requirement explicitly: employee in one browser profile, admin in another, approve, and confirm the employee's screen updates with no manual refresh.

**Checks:** two-browser test — approving updates the other window within a second · checking in turns the dot green in the admin's grid without a refresh · the bell count survives a page refresh · SSE reconnects after an API restart · all five emails render in the Ethereal preview

```bash
git add -A
git commit -m "feat: notification service, credential emails and SSE live updates"
git push
```

---

# Step 18 — Analytics and exports

> **Prompt**
>
> Build the analytics endpoint and screen S18 from §11 of `docs/Dayflow-Blueprint-v2.md`.
>
> - `GET /api/v1/analytics/overview?from&to&departmentId` (ADMIN/HR) returning in one call: attendance rate by day, time-off days by type, headcount by department, payroll cost by month, average check-in time by day, plus top-line stats (attendance rate, average work hours, total extra hours, total time-off days, total payroll cost) each with a period-over-period delta.
> - **S18 Analytics** — date range and department filters driving five Recharts visualisations: attendance-rate line, time-off-type donut, headcount bar, payroll-cost bar, and average check-in time line. Palette tokens only, accessible labels, an `EmptyState` when the range has no data, and a Download CSV affordance per chart.
> - `GET /export/attendance.csv` and `/export/timeoff.csv` honouring the same filters, streamed, dated filenames.
> - Below 640 px charts stack full width and drop x-axis ticks rather than overflowing.

**Checks:** every chart renders from seeded data with no console warnings · changing the range updates all charts from one request · CSVs open cleanly with correct headers · usable at 375 px

```bash
git add -A
git commit -m "feat: analytics dashboard with charts and CSV exports"
git push
```

---

# Step 19 — Settings, audit log, polish pass

> **Prompt**
>
> Finish the admin surface and run a full quality pass.
>
> **S19 Settings (Admin)** — tabs for: Company profile (name, logo, address, timezone), **Company code and Login ID serial width** (with a live preview of the next generated ID), Departments CRUD with head assignment, Time off types with default allocation days and the attachment requirement, Holiday calendar (list, add, delete, bulk-import a year), Work week and standard daily hours and break time, **PF rates and Professional Tax**, Coverage thresholds (make these visibly editable — we demo changing them), and the absence cutoff hour.
>
> **S20 Audit log (Admin)** — filterable stream of actor, action, entity, timestamp and IP, with an expandable before → after diff rendered as a readable two-column comparison, not raw JSON. Filters by entity, actor and date range. Paginated.
>
> **Polish pass** — walk every screen in §11 and fix:
> - Skeletons matching the final layout on every data screen (no layout shift); empty states with an action; error states with retry.
> - Confirm dialogs on every destructive action, naming what will happen.
> - Every field labelled; every error inline and specific; no generic failure text remains.
> - Complete keyboard paths through check-in, request time off, and approve. Visible focus everywhere. Dialogs trap focus and restore it on close.
> - Colour never the sole status carrier — audit every presence dot, pill, chart and ribbon.
> - Responsive sweep at 375, 768 and 1440 px. Nothing overflows or becomes unreachable.
> - Per-route `<title>`, favicon, meta description.
> - Run an accessibility check and fix contrast and label violations.
>
> Report what you fixed as a checklist.

**Checks:** all 20 screens at 375 px with no horizontal scroll · request-time-off and approve completed by keyboard alone · no bare full-page spinners · changing a coverage threshold in Settings visibly changes the Radar · changing PF rate changes the Salary Info deductions

```bash
git add -A
git commit -m "feat: settings, audit log viewer and full accessibility and responsive polish"
git push
```

---

# Step 20 — Seed data and deployment

> ⚠️ **Run this around hour 5–6, not at the end.** Re-run Part B at the end. First-time deploys under demo pressure are the classic way teams lose.

> **Prompt**
>
> **Part A — Seed.** Write `apps/api/prisma/seed.ts` producing exactly the dataset in §14.1 of `docs/Dayflow-Blueprint-v2.md`:
> - Company "Odoo India", code `OD`, with a logo. 1 Admin, 1 HR Officer, 12 employees across Engineering, Design, QA and Operations, managers assigned, **all Login IDs generated through the real engine** so the format is provably correct.
> - 90 days of back-dated attendance with realistic variance — three half-days, two unexcused absences, one habitually early and one habitually late employee, and several days with genuine extra hours so that column isn't all zeros.
> - Allocations of Paid 24 and Sick 9 per employee, part-consumed so the headers read *24 Days Available* and *09 Days Available*.
> - 14 time-off requests: 7 `TO_APPROVE` — **including two overlapping the same three days in the same department so the Coverage Radar shows a risk day out of the box** — 5 approved, 2 refused with comments, and one sick request with an attached certificate.
> - The Indian public holiday calendar, with one holiday inside a pending request's range.
> - Contracts for everyone using `defaultComponentSet()`, wages varied so the analytics have shape.
> - Two months of published payslips with generated PDFs; the current month left unrun.
> - 30 audit entries, 10 notifications.
> - All passwords `Dayflow@2026`; one demo employee left with `mustChangePassword = true` so the forced-change flow can be shown.
> - **Idempotent** — running it twice must not duplicate anything.
>
> **Part B — Deploy.** Provision Neon and migrate. Configure `apps/api` on Render (build, start, health check `/api/v1/health`, env vars documented in `docs/DEPLOY.md`). Configure `apps/web` on Vercel (build, output, SPA rewrite, `VITE_API_URL`). Set cookies to `Secure` + `SameSite=None` in production and add the Vercel domain to the CORS allow-list. Confirm both auto-deploy on push to main. Update `README.md` with live URLs, the demo credentials box, the architecture diagram, the ERD, the API table and a screenshots section. Add the credentials to the sign-in page's Demo accounts box.
>
> Verify the whole flow end to end on the **deployed** URLs.

**Checks:** seeding twice → identical row counts · a seeded Login ID matches the documented format exactly · the Radar shows a risk day with no manual setup · sign in on the deployed site as admin, HR and employee · check in, request time off, approve and download a payslip all work in production · pushing to main triggers both deployments

```bash
git add -A
git commit -m "feat: demo seed dataset and production deployment configuration"
git push
```

---

# Step 21 — Hardening, tests, submission

> **Prompt**
>
> Final hardening pass against §13 of `docs/Dayflow-Blueprint-v2.md`.
>
> **Security**
> - Audit every route for three guards: role, **company scope**, and resource ownership. Write a test suite proving (a) an employee cannot reach another employee's data by changing the ID, and (b) **a second company's admin gets 403 or an empty result on every list endpoint**. List anything that was missing and fix it.
> - Prove Salary Info is gated server-side: an HR account calling `GET /contracts` must get 403 even though the UI hides the tab.
> - Confirm helmet, CORS allow-list, cookie flags and every rate limit are active in production config.
> - Confirm no secret, key or password appears anywhere in git history.
> - Confirm uploads are capped and MIME-checked, and filenames are never client-controlled.
>
> **Tests**
> - Unit tests for all five engines: `loginId`, `salaryComponents`, `attendanceStatus`, `workingDays`, `payslip`.
> - Integration tests for four flows: register company → verify → login; create employee → login with generated ID → forced password change; request → approve → balance and attendance updated; payroll run → publish → employee downloads.
> - One Playwright smoke test walking the demo script's happy path.
> - CI green on all of it.
>
> **Submission assets**
> - `README.md`: pitch, the problem, the three differentiators with screenshots, architecture diagram, ERD, stack, local setup, deployed URLs, demo credentials, API table, team.
> - `docs/DEMO-SCRIPT.md` — the timed script from §14.2 with exact clicks.
> - Six screenshots into `docs/screenshots/`: employee grid with presence dots, Salary Info mid-recalculation, the time off request modal showing the holiday exclusion, the approvals table with the Coverage Radar expanded, the admin attendance table, analytics. Embed them in the README.
> - `docs/ARCHITECTURE.md` with the mermaid diagrams from §5 and §10 so judges can read the flows without opening code.
>
> Finish with a written gap report: every item in the §2 coverage matrix that is not fully implemented, and every §13 requirement not met.

**Checks:** CI green across typecheck, lint, unit, integration, Playwright and build · the cross-company isolation suite passes on every list endpoint · README renders on GitHub with all six screenshots · the gap report lists zero unaddressed items in the coverage matrix

```bash
git add -A
git commit -m "test: security hardening, engine and e2e tests, submission documentation"
git push
git tag -a v1.0.0 -m "Dayflow v1.0.0 — hackathon submission"
git push --tags
```

---

## If you fall behind

Cut in this order and say so in the README's Roadmap — a stated, deliberate scope decision reads far better than a half-built screen:

1. Day Ribbon strip on employee cards (keep the tables)
2. Command palette
3. Audit log **screen** (keep the writes)
4. Analytics charts 4 and 5
5. Documents tab
6. Dark theme
7. Playwright test

**Never cut:** the salary engine's live recomputation · the Coverage Radar · the attendance → payroll chain · seed data · empty and error states · the deployment.

**The one fallback that's acceptable:** if the salary engine isn't working by hour 12, ship the six named components with hardcoded formulas behind the same live-preview UI. Visually identical in a demo. Be honest about it in the README's Roadmap — judges respect a stated limitation far more than a discovered one.

## Useful mid-build prompts

| Situation | Say this |
|---|---|
| Output drifted from the board | `Compare this screen against docs/wireframes.png and §11 of the blueprint. List every deviation, then fix them.` |
| Output drifted from the spec | `Re-read docs/Dayflow-Blueprint-v2.md §<n> and correct the implementation to match exactly.` |
| Money looks wrong | `Trace this figure through the engine step by step, showing the decimal.js value at each stage. Find where the rounding is being applied too early.` |
| Something is slow | `Profile this endpoint, find the N+1 queries, and fix them with proper includes or a single aggregate. Show query counts before and after.` |
| Before every commit | `Run typecheck, lint and tests. Fix anything red. Then summarise this step's changes in one paragraph for the commit body.` |
| Final hour | `Walk docs/DEMO-SCRIPT.md against the deployed site and report anything that breaks, looks unpolished, or runs longer than the script allows.` |

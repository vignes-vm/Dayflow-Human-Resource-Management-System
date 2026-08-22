import bcrypt from "bcryptjs";
import { Role, UserStatus, Prisma } from "@prisma/client";
import { Decimal } from "decimal.js";

import { buildLoginId } from "../../src/engines/loginId.js";
import { allocateSerial } from "../../src/lib/loginIdCounter.js";
import { prisma } from "../../src/lib/prisma.js";
import { defaultComponentSet, computeContract } from "../../src/engines/salaryComponents.js";

const DEMO_PASSWORD = "Dayflow@2026";
const JOINING_YEAR = 2024;

const EMPLOYEES = [
  { f: "Rahul", l: "Dev", d: "Engineering", t: "Engineering Manager", w: 120000, isMgr: true },
  {
    f: "Amit",
    l: "Singh",
    d: "Engineering",
    t: "Backend Developer",
    w: 80000,
    mgrOf: "Engineering Manager",
  },
  {
    f: "Priya",
    l: "Patel",
    d: "Engineering",
    t: "Frontend Developer",
    w: 75000,
    mgrOf: "Engineering Manager",
  },
  {
    f: "Sara",
    l: "Khan",
    d: "Engineering",
    t: "DevOps Engineer",
    w: 90000,
    mgrOf: "Engineering Manager",
  },
  { f: "Vikram", l: "Rathore", d: "Design", t: "Design Lead", w: 100000, isMgr: true },
  { f: "Anjali", l: "Nair", d: "Design", t: "UI/UX Designer", w: 70000, mgrOf: "Design Lead" },
  { f: "Karan", l: "Johar", d: "QA", t: "QA Manager", w: 95000, isMgr: true },
  { f: "Divya", l: "Bharti", d: "QA", t: "QA Engineer", w: 60000, mgrOf: "QA Manager" },
  { f: "Rohit", l: "Sharma", d: "QA", t: "Automation Tester", w: 65000, mgrOf: "QA Manager" },
  { f: "Pooja", l: "Hegde", d: "Operations", t: "Operations Head", w: 110000, isMgr: true },
  {
    f: "Arjun",
    l: "Reddy",
    d: "Operations",
    t: "Operations Exec",
    w: 50000,
    mgrOf: "Operations Head",
  },
  {
    f: "Sneha",
    l: "Ullal",
    d: "Operations",
    t: "HR Coordinator",
    w: 55000,
    mgrOf: "Operations Head",
  },
];

export async function seed(): Promise<void> {
  const company = await prisma.company.findUnique({ where: { name: "Odoo India" } });
  if (!company) {
    console.log("  02-employees-contracts: Company 'Odoo India' not found. Skip.");
    return;
  }

  // Check if we already seeded M3
  const existingDep = await prisma.department.findFirst({ where: { companyId: company.id } });
  if (existingDep) {
    console.log("  02-employees-contracts: Departments already exist — skipping");
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const timeOffTypes = await prisma.timeOffType.findMany({ where: { companyId: company.id } });

  await prisma.$transaction(async (tx) => {
    // 1. Create Departments
    const depMap = new Map<string, string>();
    for (const d of ["Engineering", "Design", "QA", "Operations"]) {
      const dep = await tx.department.create({
        data: { companyId: company.id, name: d },
      });
      depMap.set(d, dep.id);
    }

    // 2. Create Employees
    const empMap = new Map<string, string>(); // jobTitle -> employeeId
    const pendingManagers: Array<{ empId: string; mgrTitle: string }> = [];

    let count = 0;
    for (const person of EMPLOYEES) {
      count++;
      const serial = await allocateSerial(tx, company.id, JOINING_YEAR);
      const loginId = buildLoginId({
        companyCode: company.code,
        firstName: person.f,
        lastName: person.l,
        joiningYear: JOINING_YEAR,
        serial,
        serialWidth: company.serialWidth,
      });

      const email = `${person.f.toLowerCase()}.${person.l.toLowerCase()}@odooindia.example`;

      const user = await tx.user.create({
        data: {
          companyId: company.id,
          loginId,
          email,
          passwordHash,
          role: Role.EMPLOYEE,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
          mustChangePassword: false,
        },
      });

      const emp = await tx.employee.create({
        data: {
          userId: user.id,
          companyId: company.id,
          firstName: person.f,
          lastName: person.l,
          jobTitle: person.t,
          departmentId: depMap.get(person.d),
          joinedOn: new Date(`${JOINING_YEAR}-02-${String(count).padStart(2, "0")}`),
          joiningYear: JOINING_YEAR,
          joiningSerial: serial,
        },
      });

      empMap.set(person.t, emp.id);

      if (person.isMgr) {
        await tx.department.updateMany({
          where: { id: depMap.get(person.d) },
          data: { headEmployeeId: emp.id },
        });
      }

      if (person.mgrOf) {
        pendingManagers.push({ empId: emp.id, mgrTitle: person.mgrOf });
      }

      // TimeOff Allocations
      const allocationYearStart = new Date(`${JOINING_YEAR}-01-01`);
      const allocationYearEnd = new Date(`${JOINING_YEAR}-12-31`);
      await tx.timeOffAllocation.createMany({
        data: timeOffTypes.map((t) => ({
          companyId: company.id,
          employeeId: emp.id,
          typeId: t.id,
          days: t.defaultAllocationDays,
          validFrom: allocationYearStart,
          validTo: allocationYearEnd,
          status: "APPROVED" as const,
          note: "Default allocation on hire",
        })),
      });

      // 3. Create Contract
      const preview = computeContract({
        monthlyWage: person.w,
        components: defaultComponentSet(),
        pfRateEmployee: company.pfRateEmployee.toString(),
        pfRateEmployer: company.pfRateEmployer.toString(),
        professionalTax: company.professionalTax.toString(),
      });

      const contract = await tx.contract.create({
        data: {
          companyId: company.id,
          employeeId: emp.id,
          effectiveFrom: new Date(`${JOINING_YEAR}-02-01`), // since they joined in feb
          monthlyWage: person.w.toString(),
          yearlyWage: new Decimal(person.w).times(12).toString(),
          workDaysPerWeek: company.workDaysPerWeek,
          breakHours: "0",
          createdById: user.id, // For seed, we can just let them create their own contract row
          status: "RUNNING",
        },
      });

      const componentsToInsert = defaultComponentSet().map((c, idx) => {
        const computedAmount =
          preview.lines.find((l) => l.code === c.code)?.amount ?? new Decimal(0);
        return {
          contractId: contract.id,
          sequence: idx,
          name: c.label,
          code: c.code,
          category: c.category,
          computation: c.computation as any,
          value: c.value.toString(),
          baseComponentCode: c.baseComponentCode ?? null,
          computedAmount: computedAmount.toString(),
        };
      });

      const derivedCodes = new Set(["PF_EMPLOYEE", "PROFESSIONAL_TAX", "PF_EMPLOYER"]);
      let seq = componentsToInsert.length;
      for (const line of preview.lines) {
        if (derivedCodes.has(line.code)) {
          componentsToInsert.push({
            contractId: contract.id,
            sequence: seq++,
            name: line.label,
            code: line.code,
            category: line.category,
            computation: "FIXED" as any,
            value: line.amount.toString(),
            baseComponentCode: null,
            computedAmount: line.amount.toString(),
          });
        }
      }

      await tx.salaryComponent.createMany({
        data: componentsToInsert,
      });

      // Setup default Profile data
      await tx.privateInfo.create({
        data: {
          employeeId: emp.id,
          personalEmail: `${person.f.toLowerCase()}@example.com`,
          mobile: `98${Math.floor(10000000 + Math.random() * 90000000)}`,
        },
      });

      await tx.resume.create({
        data: { employeeId: emp.id },
      });
    }

    // Assign Managers
    for (const p of pendingManagers) {
      const mgrId = empMap.get(p.mgrTitle);
      if (mgrId) {
        await tx.employee.update({
          where: { id: p.empId },
          data: { managerId: mgrId },
        });
      }
    }
  });

  console.log(`  02-employees-contracts: 12 employees with contracts seeded.`);
}

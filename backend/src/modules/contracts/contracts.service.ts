import { Prisma } from "@prisma/client";
import { Decimal } from "decimal.js";

import { prisma } from "@/lib/prisma.js";
import { writeAudit } from "@/lib/audit.js";
import { computeContract } from "@/engines/salaryComponents.js";
import { ApiError } from "@/middleware/errorHandler.js";
import type { ContractPreviewInput, CreateContractInput } from "@dayflow/shared";

// ---------------------------------------------------------------------------
// Preview Contract
// ---------------------------------------------------------------------------

export async function previewContract(companyId: string, input: ContractPreviewInput) {
  // Fetch company-level rates (PF, PT, etc.)
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { pfRateEmployee: true, pfRateEmployer: true, professionalTax: true },
  });

  const result = computeContract({
    monthlyWage: input.monthlyWage,
    components: input.components.map((c) => ({
      code: c.code,
      label: c.label,
      category: c.category,
      computation: c.computation,
      value: c.value,
      baseComponentCode: c.baseComponentCode,
    })),
    pfRateEmployee: company.pfRateEmployee,
    pfRateEmployer: company.pfRateEmployer,
    professionalTax: company.professionalTax,
  });

  return {
    lines: result.lines.map((l) => ({
      ...l,
      amount: l.amount.toFixed(2),
    })),
    totals: {
      grossEarnings: result.totals.grossEarnings.toFixed(2),
      totalEmployeeDeductions: result.totals.totalEmployeeDeductions.toFixed(2),
      totalEmployerContributions: result.totals.totalEmployerContributions.toFixed(2),
      netPay: result.totals.netPay.toFixed(2),
    },
    errors: result.errors.map((e) => {
      if (e.type === "CIRCULAR_COMPONENT_REFERENCE") {
        return { type: e.type, message: `Circular dependency detected: ${e.cycle.join(" -> ")}` };
      }
      if (e.type === "COMPONENTS_EXCEED_WAGE") {
        return { type: e.type, message: `Components exceed wage by ${e.overflow.toFixed(2)}` };
      }
      if (e.type === "MULTIPLE_BALANCE_COMPONENTS") {
        return {
          type: e.type,
          message: `Multiple BALANCE components found: ${e.codes.join(", ")}`,
        };
      }
      return {
        type: e.type,
        message: `Unknown base component: ${e.baseCode} referenced by ${e.code}`,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Create Contract
// ---------------------------------------------------------------------------

export async function createContract(
  companyId: string,
  actorId: string,
  input: CreateContractInput,
) {
  // 1. Validate employee exists in this company
  const employee = await prisma.employee.findFirst({
    where: { id: input.employeeId, companyId },
    select: { id: true },
  });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  // 2. Validate contract mathematically (no errors)
  const preview = await previewContract(companyId, input);
  if (preview.errors.length > 0) {
    throw new ApiError(400, "INVALID_CONTRACT", preview.errors[0]!.message);
  }

  // 3. Create the contract with effectiveFrom (Effective-dated design)
  // We NEVER mutate an existing contract. We insert a new one.
  const company = await prisma.company.findUniqueOrThrow({
    where: { id: companyId },
    select: { workDaysPerWeek: true, standardDailyHours: true },
  });

  const contract = await prisma.$transaction(async (tx) => {
    // Check if a contract already exists for this exact effective date
    const existingDate = await tx.contract.findUnique({
      where: {
        employeeId_effectiveFrom: {
          employeeId: input.employeeId,
          effectiveFrom: input.effectiveFrom,
        },
      },
    });

    if (existingDate) {
      throw new ApiError(409, "CONFLICT", "A contract already exists for this effective date");
    }

    const created = await tx.contract.create({
      data: {
        companyId,
        employeeId: input.employeeId,
        effectiveFrom: input.effectiveFrom,
        monthlyWage: input.monthlyWage,
        yearlyWage: new Decimal(input.monthlyWage).times(12).toString(),
        workDaysPerWeek: company.workDaysPerWeek,
        breakHours: "0", // Can be updated if we add this to schema later
        createdById: actorId,
        status: "RUNNING",
      },
    });

    // Save the computed lines as SalaryComponents
    const componentsToInsert = input.components.map((c, idx) => {
      // Find the computed amount from our successful preview
      const computedAmount = preview.lines.find((l) => l.code === c.code)?.amount ?? "0";
      return {
        contractId: created.id,
        sequence: idx,
        name: c.label,
        code: c.code,
        category: c.category,
        computation: c.computation,
        value: c.value,
        baseComponentCode: c.baseComponentCode,
        computedAmount,
      };
    });

    // Also insert the derived PF/PT lines so the contract snapshot is complete
    const derivedCodes = new Set(["PF_EMPLOYEE", "PROFESSIONAL_TAX", "PF_EMPLOYER"]);
    let seq = componentsToInsert.length;
    for (const line of preview.lines) {
      if (derivedCodes.has(line.code)) {
        componentsToInsert.push({
          contractId: created.id,
          sequence: seq++,
          name: line.label,
          code: line.code,
          category: line.category,
          // Store derived lines as FIXED in the DB since their value IS their computed amount
          computation: "FIXED",
          value: line.amount,
          baseComponentCode: null,
          computedAmount: line.amount,
        });
      }
    }

    await tx.salaryComponent.createMany({
      data: componentsToInsert,
    });

    return created;
  });

  await writeAudit({
    companyId,
    actorId,
    action: "CONTRACT_CREATED",
    entity: "Contract",
    entityId: contract.id,
    after: {
      employeeId: input.employeeId,
      effectiveFrom: input.effectiveFrom,
      monthlyWage: input.monthlyWage,
    },
  });

  return contract;
}

// ---------------------------------------------------------------------------
// List Contracts (Historical view)
// ---------------------------------------------------------------------------

export async function getContracts(employeeId: string, viewerCompanyId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: viewerCompanyId },
    select: { id: true },
  });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  const contracts = await prisma.contract.findMany({
    where: { employeeId, companyId: viewerCompanyId },
    orderBy: { effectiveFrom: "desc" },
    include: {
      components: { orderBy: { sequence: "asc" } },
    },
  });

  // Fetch createdBy users
  const creatorIds = [...new Set(contracts.map((c) => c.createdById))];
  const creators = creatorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: creatorIds } },
        include: { employee: { select: { firstName: true, lastName: true } } },
      })
    : [];
  const creatorMap = new Map(creators.map((u) => [u.id, u]));

  return contracts.map((c) => {
    const creatorUser = creatorMap.get(c.createdById);
    return {
      id: c.id,
      employeeId: c.employeeId,
      effectiveFrom: c.effectiveFrom,
      monthlyWage: c.monthlyWage.toFixed(2),
      createdAt: c.createdAt,
      createdBy: creatorUser?.employee
        ? {
            id: creatorUser.id,
            firstName: creatorUser.employee.firstName,
            lastName: creatorUser.employee.lastName,
          }
        : null,
      components: c.components.map((comp) => ({
        code: comp.code,
        label: comp.name,
        category: comp.category,
        computation: comp.computation,
        amount: comp.computedAmount.toFixed(2),
      })),
    };
  });
}

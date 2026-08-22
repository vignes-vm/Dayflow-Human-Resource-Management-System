import path from "path";
import fs from "fs/promises";
import { prisma } from "@/lib/prisma.js";
import { writeAudit } from "@/lib/audit.js";
import { ApiError } from "@/middleware/errorHandler.js";
import type {
  SelfUpdateProfileInput,
  UpdatePrivateInfoInput,
  AddSkillInput,
  AddCertificationInput,
} from "@dayflow/shared";

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

export async function getResume(employeeId: string, viewerCompanyId: string) {
  // Confirm employee belongs to this company
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: viewerCompanyId },
    select: { id: true },
  });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  const resume = await prisma.resume.findUnique({
    where: { employeeId },
    include: {
      skills: { orderBy: { createdAt: "asc" } },
      certifications: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!resume) {
    // Resume row should always exist (created on employee creation), but guard anyway
    return {
      id: null,
      about: null,
      lovesAboutJob: null,
      hobbies: null,
      skills: [],
      certifications: [],
    };
  }

  return {
    id: resume.id,
    about: resume.about,
    lovesAboutJob: resume.jobLove,
    hobbies: resume.interests,
    skills: resume.skills.map((s) => ({ id: s.id, name: s.name })),
    certifications: resume.certifications.map((c) => ({
      id: c.id,
      name: c.name,
      issuer: c.issuer,
      issuedOn: c.issuedOn,
      expiresOn: null, // field not in schema — placeholder for future migration
      url: c.url,
    })),
  };
}

export async function updateResume(
  employeeId: string,
  viewerCompanyId: string,
  actorId: string,
  input: Pick<SelfUpdateProfileInput, "about" | "lovesAboutJob" | "hobbies">,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: viewerCompanyId },
    select: { id: true },
  });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  const before = await prisma.resume.findUnique({
    where: { employeeId },
    select: { about: true, jobLove: true, interests: true },
  });

  const resume = await prisma.resume.upsert({
    where: { employeeId },
    create: {
      employeeId,
      about: input.about ?? null,
      jobLove: input.lovesAboutJob ?? null,
      interests: input.hobbies ?? null,
    },
    update: {
      ...(input.about !== undefined ? { about: input.about } : {}),
      ...(input.lovesAboutJob !== undefined ? { jobLove: input.lovesAboutJob } : {}),
      ...(input.hobbies !== undefined ? { interests: input.hobbies } : {}),
    },
  });

  await writeAudit({
    companyId: viewerCompanyId,
    actorId,
    action: "RESUME_UPDATED",
    entity: "Resume",
    entityId: resume.id,
    before,
    after: { about: resume.about, jobLove: resume.jobLove, interests: resume.interests },
  });

  return resume;
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

export async function addSkill(
  employeeId: string,
  viewerCompanyId: string,
  actorId: string,
  input: AddSkillInput,
) {
  const resume = await prisma.resume.findFirst({
    where: { employee: { id: employeeId, companyId: viewerCompanyId } },
    select: { id: true },
  });
  if (!resume) throw new ApiError(404, "NOT_FOUND", "Resume not found");

  const skill = await prisma.skill.create({
    data: { resumeId: resume.id, name: input.name },
  });

  await writeAudit({
    companyId: viewerCompanyId,
    actorId,
    action: "SKILL_ADDED",
    entity: "Skill",
    entityId: skill.id,
    after: { name: skill.name, employeeId },
  });

  return skill;
}

export async function deleteSkill(
  skillId: string,
  employeeId: string,
  viewerCompanyId: string,
  actorId: string,
) {
  const skill = await prisma.skill.findFirst({
    where: {
      id: skillId,
      resume: { employee: { id: employeeId, companyId: viewerCompanyId } },
    },
  });
  if (!skill) throw new ApiError(404, "NOT_FOUND", "Skill not found");

  await prisma.skill.delete({ where: { id: skillId } });

  await writeAudit({
    companyId: viewerCompanyId,
    actorId,
    action: "SKILL_REMOVED",
    entity: "Skill",
    entityId: skillId,
    before: { name: skill.name, employeeId },
  });
}

// ---------------------------------------------------------------------------
// Certifications
// ---------------------------------------------------------------------------

export async function addCertification(
  employeeId: string,
  viewerCompanyId: string,
  actorId: string,
  input: AddCertificationInput,
) {
  const resume = await prisma.resume.findFirst({
    where: { employee: { id: employeeId, companyId: viewerCompanyId } },
    select: { id: true },
  });
  if (!resume) throw new ApiError(404, "NOT_FOUND", "Resume not found");

  const cert = await prisma.certification.create({
    data: {
      resumeId: resume.id,
      name: input.name,
      issuer: input.issuer ?? null,
      issuedOn: input.issuedOn ?? null,
      url: input.url ?? null,
    },
  });

  await writeAudit({
    companyId: viewerCompanyId,
    actorId,
    action: "CERTIFICATION_ADDED",
    entity: "Certification",
    entityId: cert.id,
    after: { name: cert.name, employeeId },
  });

  return cert;
}

export async function deleteCertification(
  certId: string,
  employeeId: string,
  viewerCompanyId: string,
  actorId: string,
) {
  const cert = await prisma.certification.findFirst({
    where: {
      id: certId,
      resume: { employee: { id: employeeId, companyId: viewerCompanyId } },
    },
  });
  if (!cert) throw new ApiError(404, "NOT_FOUND", "Certification not found");

  await prisma.certification.delete({ where: { id: certId } });

  await writeAudit({
    companyId: viewerCompanyId,
    actorId,
    action: "CERTIFICATION_REMOVED",
    entity: "Certification",
    entityId: certId,
    before: { name: cert.name, employeeId },
  });
}

// ---------------------------------------------------------------------------
// Private Info
// ---------------------------------------------------------------------------

export async function getPrivateInfo(
  employeeId: string,
  viewerCompanyId: string,
  viewerRole: "ADMIN" | "HR" | "EMPLOYEE",
  viewerEmployeeId: string | null,
) {
  // Only self or ADMIN/HR may read private info
  const isPrivileged = viewerRole === "ADMIN" || viewerRole === "HR";
  const isSelf = employeeId === viewerEmployeeId;
  if (!isPrivileged && !isSelf) {
    throw new ApiError(403, "FORBIDDEN", "You don't have access to this");
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: viewerCompanyId },
    select: { id: true },
  });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  const info = await prisma.privateInfo.findUnique({ where: { employeeId } });
  if (!info) {
    return { id: null };
  }

  // Mask bank account: show only last 4 digits as "****1234"
  const maskedAccount = info.bankAccountNumber
    ? `${"*".repeat(Math.max(0, info.bankAccountNumber.length - 4))}${info.bankAccountNumber.slice(-4)}`
    : null;

  return {
    id: info.id,
    dateOfBirth: info.dateOfBirth,
    nationality: info.nationality,
    personalEmail: info.personalEmail,
    gender: info.gender,
    maritalStatus: info.maritalStatus,
    bankAccountNumber: maskedAccount,
    bankName: info.bankName,
    ifscCode: info.ifscCode,
    panNumber: info.panNumber,
    uanNumber: info.uanNumber,
    employeeCode: info.employeeCode,
    aadhaarLast4: info.aadhaarLast4,
  };
}

export async function updatePrivateInfo(
  employeeId: string,
  viewerCompanyId: string,
  viewerRole: "ADMIN" | "HR" | "EMPLOYEE",
  viewerEmployeeId: string | null,
  actorId: string,
  input: UpdatePrivateInfoInput,
) {
  // Only self or ADMIN/HR may write private info
  const isPrivileged = viewerRole === "ADMIN" || viewerRole === "HR";
  const isSelf = employeeId === viewerEmployeeId;
  if (!isPrivileged && !isSelf) {
    throw new ApiError(403, "FORBIDDEN", "You don't have access to this");
  }

  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId: viewerCompanyId },
    select: { id: true },
  });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  const before = await prisma.privateInfo.findUnique({
    where: { employeeId },
    select: { dateOfBirth: true, nationality: true, gender: true, maritalStatus: true },
  });

  // Bank account number: store the full number the caller sends
  // (aadhaarLast4 is already pre-validated to be 4 digits by the schema)
  const updated = await prisma.privateInfo.upsert({
    where: { employeeId },
    create: {
      employeeId,
      dateOfBirth: input.dateOfBirth ?? null,
      nationality: input.nationality ?? null,
      personalEmail: input.personalEmail ?? null,
      gender: input.gender ?? null,
      maritalStatus: input.maritalStatus ?? null,
      bankAccountNumber: input.bankAccountNumber ?? null,
      bankName: input.bankName ?? null,
      ifscCode: input.ifscCode ?? null,
      panNumber: input.panNumber ?? null,
      uanNumber: input.uanNumber ?? null,
      employeeCode: input.employeeCode ?? null,
      aadhaarLast4: input.aadhaarLast4 ?? null,
    },
    update: {
      ...(input.dateOfBirth !== undefined ? { dateOfBirth: input.dateOfBirth } : {}),
      ...(input.nationality !== undefined ? { nationality: input.nationality } : {}),
      ...(input.personalEmail !== undefined ? { personalEmail: input.personalEmail } : {}),
      ...(input.gender !== undefined ? { gender: input.gender } : {}),
      ...(input.maritalStatus !== undefined ? { maritalStatus: input.maritalStatus } : {}),
      ...(input.bankAccountNumber !== undefined
        ? { bankAccountNumber: input.bankAccountNumber }
        : {}),
      ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
      ...(input.ifscCode !== undefined ? { ifscCode: input.ifscCode } : {}),
      ...(input.panNumber !== undefined ? { panNumber: input.panNumber } : {}),
      ...(input.uanNumber !== undefined ? { uanNumber: input.uanNumber } : {}),
      ...(input.employeeCode !== undefined ? { employeeCode: input.employeeCode } : {}),
      ...(input.aadhaarLast4 !== undefined ? { aadhaarLast4: input.aadhaarLast4 } : {}),
    },
  });

  await writeAudit({
    companyId: viewerCompanyId,
    actorId,
    action: "PRIVATE_INFO_UPDATED",
    entity: "PrivateInfo",
    entityId: updated.id,
    before: before ?? {},
    after: {
      dateOfBirth: updated.dateOfBirth,
      nationality: updated.nationality,
      gender: updated.gender,
      maritalStatus: updated.maritalStatus,
      // Never log bank/ID numbers in the audit trail
    },
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Avatar upload
// ---------------------------------------------------------------------------

export async function updateAvatar(
  employeeId: string,
  companyId: string,
  actorId: string,
  file: Express.Multer.File,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true, avatarUrl: true },
  });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  // Delete the old avatar file if it's a local upload
  if (employee.avatarUrl && employee.avatarUrl.startsWith("/uploads/")) {
    const oldPath = path.join(process.cwd(), employee.avatarUrl);
    await fs.unlink(oldPath).catch(() => undefined); // best-effort
  }

  const avatarUrl = `/uploads/avatars/${file.filename}`;
  await prisma.employee.update({
    where: { id: employeeId },
    data: { avatarUrl },
  });

  await writeAudit({
    companyId,
    actorId,
    action: "AVATAR_UPDATED",
    entity: "Employee",
    entityId: employeeId,
    after: { avatarUrl },
  });

  return { avatarUrl };
}

// ---------------------------------------------------------------------------
// Document upload
// ---------------------------------------------------------------------------

export async function uploadDocument(
  employeeId: string,
  companyId: string,
  actorId: string,
  file: Express.Multer.File,
  name: string,
) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true },
  });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  const doc = await prisma.document.create({
    data: {
      companyId,
      employeeId,
      name,
      url: `/uploads/documents/${file.filename}`,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      uploadedById: actorId,
    },
  });

  await writeAudit({
    companyId,
    actorId,
    action: "DOCUMENT_UPLOADED",
    entity: "Document",
    entityId: doc.id,
    after: { name, employeeId },
  });

  return doc;
}

export async function getDocuments(employeeId: string, companyId: string) {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, companyId },
    select: { id: true },
  });
  if (!employee) throw new ApiError(404, "NOT_FOUND", "Employee not found");

  return prisma.document.findMany({
    where: { employeeId, companyId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      url: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
}

// ---------------------------------------------------------------------------
// Security — active sessions
// ---------------------------------------------------------------------------

export async function getActiveSessions(userId: string) {
  return prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, createdAt: true, expiresAt: true, familyId: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeSession(sessionId: string, userId: string) {
  const token = await prisma.refreshToken.findFirst({
    where: { id: sessionId, userId, revokedAt: null },
  });
  if (!token) throw new ApiError(404, "NOT_FOUND", "Session not found");

  await prisma.refreshToken.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });
}

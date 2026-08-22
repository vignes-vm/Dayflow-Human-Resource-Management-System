export interface Company {
  id: string;
  name: string;
  code: string;
  logoUrl: string | null;
  address: string | null;
  timezone: string;
  workDaysPerWeek: number;
  standardDailyHours: number;
  breakMinutes: number;
  pfRateEmployee: string;
  pfRateEmployer: string;
  professionalTax: string;
  serialWidth: number;
  coverageOkThreshold: number;
  coverageRiskThreshold: number;
  absenceCutoffHour: number;
}

export interface Holiday {
  id: string;
  date: string;
  name: string;
}

export interface LoginIdPreview {
  preview: string;
  serialWidth: number;
  nextSerial: number;
}

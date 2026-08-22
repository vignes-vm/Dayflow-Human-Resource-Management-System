import { randomInt } from "node:crypto";

/**
 * Pure Login ID + first-password generation. No DB access — see CLAUDE.md
 * rule 7. Format: [COMPANY_CODE(2)][FIRST_NAME(2)][LAST_NAME(2)][JOINING_YEAR(4)][SERIAL(N)]
 */

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Take the first `width` alphabetic characters (diacritics stripped), uppercased, right-padded with X. */
function takeInitials(name: string, width = 2): string {
  const letters = stripDiacritics(name)
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase();
  return letters.slice(0, width).padEnd(width, "X");
}

/** First two alphabetic characters of a company name, uppercased. "Odoo India" → "OD". */
export function deriveCompanyCode(companyName: string): string {
  return takeInitials(companyName, 2);
}

export interface BuildLoginIdInput {
  companyCode: string;
  firstName: string;
  lastName: string;
  joiningYear: number;
  serial: number;
  serialWidth: number;
}

export function buildLoginId({
  companyCode,
  firstName,
  lastName,
  joiningYear,
  serial,
  serialWidth,
}: BuildLoginIdInput): string {
  const cc = stripDiacritics(companyCode)
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .slice(0, 2)
    .padEnd(2, "X");
  const ff = takeInitials(firstName, 2);
  const ll = takeInitials(lastName, 2);
  const yyyy = String(joiningYear).padStart(4, "0");
  const nnnn = String(serial).padStart(serialWidth, "0");
  return `${cc}${ff}${ll}${yyyy}${nnnn}`;
}

const AMBIGUOUS = new Set(["0", "O", "1", "l", "I"]);
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ".split("").filter((c) => !AMBIGUOUS.has(c));
const LOWER = "abcdefghijkmnopqrstuvwxyz".split("").filter((c) => !AMBIGUOUS.has(c));
const DIGITS = "23456789".split("").filter((c) => !AMBIGUOUS.has(c));
const SYMBOLS = "!@#$%^&*-_=+?".split("");
const ALL = [...UPPER, ...LOWER, ...DIGITS, ...SYMBOLS];

function pick(chars: string[]): string {
  return chars[randomInt(chars.length)]!;
}

/** 12 characters, no ambiguous glyphs, guaranteed upper + lower + digit + symbol. */
export function generatePassword(length = 12): string {
  const required = [pick(UPPER), pick(LOWER), pick(DIGITS), pick(SYMBOLS)];
  const rest = Array.from({ length: length - required.length }, () => pick(ALL));
  const chars = [...required, ...rest];

  // Fisher-Yates shuffle so the required categories aren't always in the same position
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }

  return chars.join("");
}

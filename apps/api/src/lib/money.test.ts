import { describe, expect, it } from "vitest";

import { add, mul, pctOf, round2, sub, toDisplay } from "@/lib/money.js";

describe("money", () => {
  it("adds without floating-point drift", () => {
    // 0.1 + 0.2 === 0.30000000000000004 in JS floats — decimal.js must not reproduce that
    expect(add("0.1", "0.2").toString()).toBe("0.3");
  });

  it("computes a percentage of a base amount", () => {
    // 50,000 at 8.33% — the exact figure the acceptance check names
    expect(pctOf(50000, 8.33).toString()).toBe("4165");
  });

  it("rounds a percentage result half-up to 2dp with no artefacts", () => {
    // 33,333 * 8.33% = 2776.6389 → rounds to 2776.64, never 2776.6388999...
    const result = round2(pctOf(33333, 8.33));
    expect(result.toFixed(2)).toBe("2776.64");
  });

  it("rounds half-up at exactly the midpoint", () => {
    expect(round2("2082.495").toFixed(2)).toBe("2082.50");
    expect(round2("0.005").toFixed(2)).toBe("0.01");
  });

  it("subtracts and multiplies without float artefacts", () => {
    expect(sub("50000", "46232").toString()).toBe("3768");
    expect(mul("2082.5", "2").toString()).toBe("4165");
  });

  it("formats a display string with the rupee sign and 2dp", () => {
    expect(toDisplay(4165)).toBe("₹4165.00");
    expect(toDisplay("2082.4999999")).toBe("₹2082.50");
  });
});

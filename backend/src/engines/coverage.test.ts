import { describe, expect, it } from "vitest";

import { computeCoverageLevel, computeCoveragePercent } from "@/engines/coverage.js";

describe("computeCoveragePercent", () => {
  it("returns 100 for a team of zero (nothing to be away from)", () => {
    expect(computeCoveragePercent(0, 0)).toBe(100);
  });

  it("returns 100 when nobody is away", () => {
    expect(computeCoveragePercent(8, 0)).toBe(100);
  });

  it("rounds to the nearest percent", () => {
    expect(computeCoveragePercent(8, 2)).toBe(75);
  });

  it("clamps to 0 when everyone is away", () => {
    expect(computeCoveragePercent(4, 4)).toBe(0);
  });
});

describe("computeCoverageLevel", () => {
  it("is ok at exactly the ok threshold", () => {
    expect(computeCoverageLevel(70, 70, 50)).toBe("ok");
  });

  it("is watch just below the ok threshold", () => {
    expect(computeCoverageLevel(69, 70, 50)).toBe("watch");
  });

  it("is watch at exactly the risk threshold", () => {
    expect(computeCoverageLevel(50, 70, 50)).toBe("watch");
  });

  it("is risk just below the risk threshold", () => {
    expect(computeCoverageLevel(49, 70, 50)).toBe("risk");
  });
});

import { describe, expect, it } from "vitest";

import { buildLoginId, deriveCompanyCode, generatePassword } from "@/engines/loginId.js";

describe("deriveCompanyCode", () => {
  it("takes the first two alphabetic characters, uppercased", () => {
    expect(deriveCompanyCode("Odoo India")).toBe("OD");
  });

  it("skips spaces to find two letters", () => {
    expect(deriveCompanyCode("A Company")).toBe("AC");
  });
});

describe("buildLoginId", () => {
  it("builds the worked example from the blueprint", () => {
    const id = buildLoginId({
      companyCode: "OD",
      firstName: "John",
      lastName: "Doe",
      joiningYear: 2023,
      serial: 1,
      serialWidth: 4,
    });
    expect(id).toBe("ODJODO20230001");
  });

  it("pads a one-letter name with X — 'Li Wu'", () => {
    const id = buildLoginId({
      companyCode: "OD",
      firstName: "Li",
      lastName: "Wu",
      joiningYear: 2023,
      serial: 1,
      serialWidth: 4,
    });
    expect(id.slice(2, 6)).toBe("LIWU");
  });

  it("pads a one-letter first name with X — 'A Kumar'", () => {
    const id = buildLoginId({
      companyCode: "OD",
      firstName: "A",
      lastName: "Kumar",
      joiningYear: 2023,
      serial: 1,
      serialWidth: 4,
    });
    expect(id.slice(2, 6)).toBe("AXKU");
  });

  it("strips hyphens and accents before taking initials", () => {
    const id = buildLoginId({
      companyCode: "OD",
      firstName: "Anne-Marie",
      lastName: "Núñez",
      joiningYear: 2023,
      serial: 1,
      serialWidth: 4,
    });
    expect(id.slice(2, 6)).toBe("ANNU");
  });

  it("pads the serial to the configured width", () => {
    const id = buildLoginId({
      companyCode: "OD",
      firstName: "John",
      lastName: "Doe",
      joiningYear: 2023,
      serial: 42,
      serialWidth: 4,
    });
    expect(id.endsWith("0042")).toBe(true);
  });

  it("is fully uppercase", () => {
    const id = buildLoginId({
      companyCode: "od",
      firstName: "john",
      lastName: "doe",
      joiningYear: 2023,
      serial: 1,
      serialWidth: 4,
    });
    expect(id).toBe(id.toUpperCase());
  });
});

describe("generatePassword", () => {
  it("generates 12 characters with no ambiguous glyphs", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(pw).toHaveLength(12);
      expect(pw).not.toMatch(/[0O1lI]/);
    }
  });

  it("always contains upper, lower, digit and symbol", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generatePassword();
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[!@#$%^&*\-_=+?]/);
    }
  });
});

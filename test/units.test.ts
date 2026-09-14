import { describe, expect, it } from "vitest";
import {
  UM_PER_FOOT,
  UM_PER_INCH,
  feet,
  feetAndInches,
  formatArchitecturalLength,
  parseArchitecturalLength,
} from "../src/core/units.js";

describe("architectural length units", () => {
  it.each([
    ["49'2\"", 49, 2],
    ["79'2\"", 79, 2],
    ["10'", 10, 0],
    ["10'6\"", 10, 6],
    ["10' 6\"", 10, 6],
    ["9'3\"", 9, 3],
    ["4'", 4, 0],
  ])("parses and exactly round-trips %s", (text, footPart, inchPart) => {
    const parsed = parseArchitecturalLength(text);
    expect(parsed).toBe(feetAndInches(footPart, inchPart));
    expect(parseArchitecturalLength(formatArchitecturalLength(parsed))).toBe(parsed);
  });

  it("stores 49'2\" and 79'2\" as exact integer micrometres", () => {
    expect(parseArchitecturalLength("49'2\"")).toBe(49 * UM_PER_FOOT + 2 * UM_PER_INCH);
    expect(parseArchitecturalLength("79'2\"")).toBe(79 * UM_PER_FOOT + 2 * UM_PER_INCH);
  });

  it("accepts decimal feet for legacy compatibility", () => {
    expect(parseArchitecturalLength("10.5")).toBe(feetAndInches(10, 6));
    expect(parseArchitecturalLength("10.5 ft")).toBe(feetAndInches(10, 6));
  });

  it("accepts plain inches", () => {
    expect(parseArchitecturalLength('18"')).toBe(feetAndInches(1, 6));
    expect(parseArchitecturalLength("18 inches")).toBe(feetAndInches(1, 6));
  });

  it.each(["", "-4'", "10'12\"", "abc", "4m", "0'"])("rejects invalid dimension %j", (text) => {
    expect(() => parseArchitecturalLength(text)).toThrow();
  });

  it("permits zero only for explicitly nullable-style settings", () => {
    expect(parseArchitecturalLength("0'", { allowZero: true })).toBe(0);
    expect(feet(4)).toBe(1_219_200);
  });
});

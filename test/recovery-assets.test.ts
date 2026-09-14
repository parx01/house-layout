import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPTION_3_REFERENCE_SHA256 } from "../src/project/option3-baseline.js";

describe("Option 3 recovery assets", () => {
  it("preserves the original tracing reference image", () => {
    const image = readFileSync(new URL("../dist/assets/option-3-reference.png", import.meta.url));
    expect(createHash("sha256").update(image).digest("hex")).toBe(OPTION_3_REFERENCE_SHA256);
  });
});

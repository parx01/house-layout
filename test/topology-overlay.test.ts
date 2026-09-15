import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOption3TopologyOverlaySvg } from "../src/dev/option3-topology-overlay.js";

describe("Option-3 diagnostic topology overlay", () => {
  it("is reproducible, dev-only, and contains every canonical wall and node", () => {
    const artifact = readFileSync(
      new URL("../diagnostics/option-3-topology-overlay.svg", import.meta.url),
      "utf8",
    );
    expect(artifact).toBe(createOption3TopologyOverlaySvg());
    expect(artifact).toContain('../dist/assets/option-3-reference.png');
    expect(artifact.match(/class="wall-band"/g)).toHaveLength(41);
    expect(artifact.match(/class="wall-centre"/g)).toHaveLength(41);
    expect(artifact.match(/class="topology-node"/g)).toHaveLength(29);
  });
});

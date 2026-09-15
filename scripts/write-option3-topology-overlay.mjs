import { readFileSync, writeFileSync } from "node:fs";
import { createOption3TopologyOverlaySvg } from "../dist/foundation/dev/option3-topology-overlay.js";

const target = new URL("../diagnostics/option-3-topology-overlay.svg", import.meta.url);
const generated = createOption3TopologyOverlaySvg();

if (process.argv.includes("--check")) {
  const current = readFileSync(target, "utf8");
  if (current !== generated) {
    throw new Error("Diagnostic topology overlay is stale; run npm run diagnostic:topology-overlay.");
  }
} else {
  writeFileSync(target, generated, "utf8");
}

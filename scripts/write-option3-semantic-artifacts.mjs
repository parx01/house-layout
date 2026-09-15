import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  createOption3SemanticMappingMarkdown,
  createOption3SemanticOverlaySvg,
} from "../dist/foundation/dev/option3-semantic-artifacts.js";

const artifacts = [
  {
    target: new URL("../diagnostics/option-3-semantic-spaces-overlay.svg", import.meta.url),
    generated: createOption3SemanticOverlaySvg(),
  },
  {
    target: new URL("../dist/diagnostics/option-3-semantic-spaces-overlay.svg", import.meta.url),
    generated: createOption3SemanticOverlaySvg("../assets/option-3-reference.png"),
  },
  {
    target: new URL("../docs/option-3-semantic-space-mapping.md", import.meta.url),
    generated: createOption3SemanticMappingMarkdown(),
  },
];

if (!process.argv.includes("--check")) {
  mkdirSync(new URL("../dist/diagnostics/", import.meta.url), { recursive: true });
}

for (const artifact of artifacts) {
  if (process.argv.includes("--check")) {
    const current = readFileSync(artifact.target, "utf8");
    if (current !== artifact.generated) {
      throw new Error(`A3.2 semantic artifact is stale: ${artifact.target.pathname}`);
    }
  } else {
    writeFileSync(artifact.target, artifact.generated, "utf8");
  }
}

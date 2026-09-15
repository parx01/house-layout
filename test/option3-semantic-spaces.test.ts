import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  createOption3SemanticMappingMarkdown,
  createOption3SemanticOverlaySvg,
} from "../src/dev/option3-semantic-artifacts.js";
import { loadProjectValue, parseProjectJson, serializeProject } from "../src/persistence/project-storage.js";
import {
  createOption3ProjectV2,
  OPTION_3_V1_RECOVERY_STATE,
} from "../src/project/option3-baseline.js";
import {
  createOption3SemanticSpaceMappingRows,
  createOption3SemanticSpacesV1,
} from "../src/project/option3-semantic-spaces.js";
import { createOption3TopologyV2 } from "../src/project/option3-topology.js";
import { extractBoundedFaces } from "../src/spaces/extract-faces.js";

const deferredSpaces = { status: "deferred", targetStage: "A2", modelVersion: null, data: null } as const;

describe("A3.2 curated Option-3 semantic mapping", () => {
  it("matches the deterministic 13-space golden fixture exactly", () => {
    const fixture = JSON.parse(readFileSync(
      new URL("../fixtures/option-3-semantic-spaces-v1.json", import.meta.url),
      "utf8",
    ));
    expect(createOption3SemanticSpacesV1()).toEqual(fixture);
    expect(createOption3ProjectV2().spaces).toEqual(fixture);
  });

  it("binds each persistent SpaceId to exactly one existing face", () => {
    const topology = createOption3TopologyV2();
    const faceIds = extractBoundedFaces(topology).faces.map((face) => face.id);
    const spaces = createOption3SemanticSpacesV1().spaces;
    expect(spaces).toHaveLength(13);
    expect(new Set(spaces.map((space) => space.id)).size).toBe(13);
    expect(new Set(spaces.map((space) => space.faceId)).size).toBe(13);
    expect([...spaces.map((space) => space.faceId)].sort()).toEqual([...faceIds].sort());
    for (const space of spaces) expect(space.id).not.toBe(space.faceId);
  });

  it("fixes the curated names, categories, face IDs, and derived areas", () => {
    expect(createOption3SemanticSpaceMappingRows().map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      faceId: row.faceId,
      areaUm2: row.areaUm2,
    }))).toEqual([
      { id: "s-bedroom-1", name: "Bedroom 1", category: "room", faceId: "f-dde2d722d470e5e8", areaUm2: 19_617_036_140_000 },
      { id: "s-toilet-1", name: "Toilet 1", category: "service", faceId: "f-4500a68c39844fc4", areaUm2: 5_230_339_425_000 },
      { id: "s-dress-1", name: "Dress 1", category: "storage", faceId: "f-25299ab9d0600da6", areaUm2: 3_282_409_675_000 },
      { id: "s-toilet-2", name: "Toilet 2", category: "service", faceId: "f-41bc3b811ac8bc6a", areaUm2: 5_256_571_275_000 },
      { id: "s-dress-2", name: "Dress 2", category: "storage", faceId: "f-07944bbfa1fe0b50", areaUm2: 3_298_872_025_000 },
      { id: "s-bedroom-2", name: "Bedroom 2", category: "room", faceId: "f-46f1f10484862bb1", areaUm2: 19_617_036_140_000 },
      { id: "s-lobby-dining-puja", name: "Lobby / Dining with Puja Alcove", category: "other", faceId: "f-c26ea4cfc8e5967d", areaUm2: 59_030_851_840_000 },
      { id: "s-kitchen", name: "Kitchen", category: "service", faceId: "f-995c81a969eb9c62", areaUm2: 10_950_107_560_000 },
      { id: "s-staircase", name: "Staircase", category: "circulation", faceId: "f-5bd20450438f7e84", areaUm2: 10_005_182_600_000 },
      { id: "s-living-room", name: "Living Room", category: "room", faceId: "f-b90cdc1e2457fadd", areaUm2: 16_446_188_850_000 },
      { id: "s-wash-area", name: "Wash Area", category: "service", faceId: "f-c4be109283d52551", areaUm2: 2_496_769_200_000 },
      { id: "s-toilet-3", name: "Toilet 3", category: "service", faceId: "f-ce4b77ad898b046f", areaUm2: 5_274_506_850_000 },
      { id: "s-guest-bedroom", name: "Guest Bedroom", category: "room", faceId: "f-9b08821b6b5e1967", areaUm2: 16_793_887_400_000 },
    ]);
  });

  it("round-trips stable identities and bindings without changing topology", () => {
    const baseline = createOption3ProjectV2();
    const topologyBefore = structuredClone(baseline.topology);
    const recovered = parseProjectJson(serializeProject(baseline));
    expect(recovered.spaces).toEqual(baseline.spaces);
    expect(recovered.topology).toEqual(createOption3TopologyV2());
    expect(baseline.topology).toEqual(topologyBefore);
    expect(serializeProject(recovered)).not.toContain("areaUm2");
  });

  it("keeps explicit V1 recovery and edited/arbitrary V1 projects semantically deferred", () => {
    expect(createOption3ProjectV2(structuredClone(OPTION_3_V1_RECOVERY_STATE)).spaces).toEqual(deferredSpaces);
    expect(loadProjectValue({ version: 1, ...structuredClone(OPTION_3_V1_RECOVERY_STATE) }).spaces).toEqual(deferredSpaces);

    const edited = structuredClone(OPTION_3_V1_RECOVERY_STATE);
    edited.rooms[0]!.x += 10;
    expect(loadProjectValue({ version: 1, ...edited }).spaces).toEqual(deferredSpaces);

    const arbitrary = structuredClone(OPTION_3_V1_RECOVERY_STATE);
    arbitrary.site.width = 14_000;
    expect(loadProjectValue({ version: 1, ...arbitrary }).spaces).toEqual(deferredSpaces);
  });

  it("keeps the audit report and labeled reference overlay deterministic", () => {
    const markdown = readFileSync(
      new URL("../docs/option-3-semantic-space-mapping.md", import.meta.url),
      "utf8",
    );
    const svg = readFileSync(
      new URL("../diagnostics/option-3-semantic-spaces-overlay.svg", import.meta.url),
      "utf8",
    );
    const previewSvg = readFileSync(
      new URL("../dist/diagnostics/option-3-semantic-spaces-overlay.svg", import.meta.url),
      "utf8",
    );
    expect(markdown).toBe(createOption3SemanticMappingMarkdown());
    expect(svg).toBe(createOption3SemanticOverlaySvg());
    expect(svg).toContain('../dist/assets/option-3-reference.png');
    expect(previewSvg).toBe(createOption3SemanticOverlaySvg("../assets/option-3-reference.png"));
    expect(previewSvg).toContain('../assets/option-3-reference.png');
    expect(svg.match(/class="semantic-face"/g)).toHaveLength(13);
    expect(svg.match(/class="semantic-label"/g)).toHaveLength(13);
    expect(svg.match(/class="wall-band"/g)).toHaveLength(41);
    expect(markdown).toContain("`PUJA RM.` is a three-sided alcove open to");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOption3SpecialSpaceClassificationMarkdown } from "../src/dev/option3-semantic-artifacts.js";
import { parseProjectJson, serializeProject } from "../src/persistence/project-storage.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import { createOption3SemanticSpacesV2 } from "../src/project/option3-semantic-spaces.js";
import { validateA3CompleteProjectV2 } from "../src/project/validation.js";
import { deriveArchitecturalUnderstanding } from "../src/spaces/architectural-understanding.js";
import { extractBoundedFaces } from "../src/spaces/extract-faces.js";
import {
  migrateSemanticSpacesV1ToV2,
  spaceId,
  validateSemanticSpacesV2,
  type SemanticSpaceV1,
  type SemanticSpaceV2,
  type SemanticSpacesV1,
  type SemanticSpacesV2,
} from "../src/spaces/semantic-model.js";
import { rectangleTopology } from "./fixtures/topology.js";

function legacyV1Spaces(): SemanticSpacesV1 {
  const face = extractBoundedFaces(rectangleTopology()).faces[0]!;
  return {
    status: "active",
    modelVersion: 1,
    spaces: [{ id: spaceId("s-legacy"), name: "Legacy", category: "service", faceId: face.id }],
  };
}

function courtyardSpaces(): SemanticSpacesV2 {
  const face = extractBoundedFaces(rectangleTopology()).faces[0]!;
  return {
    status: "active",
    modelVersion: 2,
    spaces: [{
      id: spaceId("s-courtyard"),
      name: "Open Courtyard",
      category: "other",
      architecturalRole: "courtyardVoid",
      enclosure: "openToSky",
      faceId: face.id,
    }],
  };
}

describe("A3.5 special architectural space semantics", () => {
  it("keeps an open-to-sky courtyard as a real bounded semantic space", () => {
    const topology = rectangleTopology();
    const spaces = validateSemanticSpacesV2(courtyardSpaces(), topology);
    const result = deriveArchitecturalUnderstanding(topology, spaces);
    expect(result.spaces).toHaveLength(1);
    expect(result.spaces[0]).toEqual(expect.objectContaining({
      spaceId: "s-courtyard",
      architecturalRole: "courtyardVoid",
      enclosure: "openToSky",
      centreLineAreaUm2: 12_000_000_000_000,
    }));
    expect(result.spaces[0]!.face.id).toBe(spaces.spaces[0]!.faceId);
  });

  it("strictly validates roles/enclosures without deriving them from category", () => {
    const topology = rectangleTopology();
    const openCirculation = structuredClone(courtyardSpaces()) as any;
    openCirculation.spaces[0].category = "service";
    openCirculation.spaces[0].architecturalRole = "circulation";
    expect(validateSemanticSpacesV2(openCirculation, topology).spaces[0]).toEqual(expect.objectContaining({
      category: "service",
      architecturalRole: "circulation",
      enclosure: "openToSky",
    }));

    const missingRole = structuredClone(courtyardSpaces()) as any;
    delete missingRole.spaces[0].architecturalRole;
    expect(() => validateSemanticSpacesV2(missingRole, topology)).toThrow("architecturalRole is required");

    const invalidRole = structuredClone(courtyardSpaces()) as any;
    invalidRole.spaces[0].architecturalRole = "patioMaybe";
    expect(() => validateSemanticSpacesV2(invalidRole, topology)).toThrow("architecturalRole must be one of");

    const invalidEnclosure = structuredClone(courtyardSpaces()) as any;
    invalidEnclosure.spaces[0].enclosure = "partlyCovered";
    expect(() => validateSemanticSpacesV2(invalidEnclosure, topology)).toThrow("enclosure must be one of");

    const coveredCourtyard = structuredClone(courtyardSpaces()) as any;
    coveredCourtyard.spaces[0].enclosure = "enclosedCovered";
    expect(() => validateSemanticSpacesV2(coveredCourtyard, topology)).toThrow(
      'enclosure must equal "openToSky" when architecturalRole is "courtyardVoid"',
    );
  });

  it("migrates V1 semantics to explicit unclassified values rather than guessing from category", () => {
    const migrated = migrateSemanticSpacesV1ToV2(legacyV1Spaces(), rectangleTopology());
    expect(migrated).toEqual({
      status: "active",
      modelVersion: 2,
      spaces: [{
        ...legacyV1Spaces().spaces[0],
        architecturalRole: "unclassified",
        enclosure: "unclassified",
      }],
    });
    expect(migrated.spaces[0]!.category).toBe("service");
    expect(migrated.spaces[0]!.architecturalRole).not.toBe("service");
  });

  it("migrates revision-5 ProjectV2 saves, round-trips roles, and preserves SpaceIds/FaceIds", () => {
    const current = createOption3ProjectV2();
    if (current.spaces.status !== "active") throw new Error("Active spaces required.");
    const revision5 = structuredClone(current) as any;
    revision5.schemaRevision = 5;
    revision5.spaces = {
      status: "active",
      modelVersion: 1,
      spaces: current.spaces.spaces.map((space: SemanticSpaceV2): SemanticSpaceV1 => ({
        id: space.id,
        name: space.name,
        category: space.category,
        faceId: space.faceId,
      })),
    };
    const migrated = parseProjectJson(JSON.stringify(revision5));
    expect(migrated.schemaRevision).toBe(6);
    expect(migrated.spaces.status).toBe("active");
    if (migrated.spaces.status !== "active") throw new Error("Migrated spaces required.");
    expect(migrated.spaces.spaces.map((space) => [space.id, space.faceId])).toEqual(
      current.spaces.spaces.map((space) => [space.id, space.faceId]),
    );
    expect(migrated.spaces.spaces.every((space) =>
      space.architecturalRole === "unclassified" && space.enclosure === "unclassified")).toBe(true);
    expect(parseProjectJson(serializeProject(migrated))).toEqual(migrated);
    expect(() => validateA3CompleteProjectV2(migrated)).toThrow("is not A3-complete; unclassified spaces");
  });

  it("classifies every curated Option-3 space explicitly without inventing an open-to-sky face", () => {
    const spaces = createOption3SemanticSpacesV2().spaces;
    expect(spaces.map(({ id, category, architecturalRole, enclosure }) => ({
      id,
      category,
      architecturalRole,
      enclosure,
    }))).toEqual([
      { id: "s-bedroom-1", category: "room", architecturalRole: "ordinaryRoom", enclosure: "enclosedCovered" },
      { id: "s-toilet-1", category: "service", architecturalRole: "service", enclosure: "enclosedCovered" },
      { id: "s-dress-1", category: "storage", architecturalRole: "storage", enclosure: "enclosedCovered" },
      { id: "s-toilet-2", category: "service", architecturalRole: "service", enclosure: "enclosedCovered" },
      { id: "s-dress-2", category: "storage", architecturalRole: "storage", enclosure: "enclosedCovered" },
      { id: "s-bedroom-2", category: "room", architecturalRole: "ordinaryRoom", enclosure: "enclosedCovered" },
      { id: "s-lobby-dining-puja", category: "other", architecturalRole: "circulation", enclosure: "enclosedCovered" },
      { id: "s-kitchen", category: "service", architecturalRole: "service", enclosure: "enclosedCovered" },
      { id: "s-staircase", category: "circulation", architecturalRole: "staircase", enclosure: "enclosedCovered" },
      { id: "s-living-room", category: "room", architecturalRole: "ordinaryRoom", enclosure: "enclosedCovered" },
      { id: "s-wash-area", category: "service", architecturalRole: "service", enclosure: "enclosedCovered" },
      { id: "s-toilet-3", category: "service", architecturalRole: "service", enclosure: "enclosedCovered" },
      { id: "s-guest-bedroom", category: "room", architecturalRole: "ordinaryRoom", enclosure: "enclosedCovered" },
    ]);
    expect(spaces.filter((space) => space.enclosure === "openToSky")).toEqual([]);
  });

  it("exposes roles in A3.4 understanding while leaving coverage policy deferred", () => {
    const project = createOption3ProjectV2();
    if (project.topology.status !== "active" || project.spaces.status !== "active") throw new Error("Active baseline required.");
    const result = deriveArchitecturalUnderstanding(project.topology, project.spaces);
    expect(result.semanticModelVersion).toBe(2);
    expect(result.spaces.find((space) => space.spaceId === "s-staircase")).toEqual(expect.objectContaining({
      category: "circulation",
      architecturalRole: "staircase",
      enclosure: "enclosedCovered",
    }));
    expect(project.site.coverageRule).toEqual({ numerator: 66, denominator: 100, status: "userSuppliedUnverified" });
    expect(project.building.coverageStatus).toBe("deferredToExteriorEnvelopeA4");
    expect(JSON.stringify(result)).not.toContain("countsTowardCoverage");
  });

  it("keeps the complete classification report deterministic", () => {
    const report = readFileSync(
      new URL("../docs/option-3-special-space-classification.md", import.meta.url),
      "utf8",
    );
    expect(report).toBe(createOption3SpecialSpaceClassificationMarkdown());
    expect(report.match(/^\| `s-/gm)).toHaveLength(13);
    expect(report).toContain("13 spaces; 0 open-to-sky in Option-3");
  });
});

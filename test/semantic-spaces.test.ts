import { describe, expect, it } from "vitest";
import {
  parseProjectJson,
  serializeProject,
  updateProjectFromLegacyEditorState,
} from "../src/persistence/project-storage.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import { validateProjectV2 } from "../src/project/validation.js";
import { extractBoundedFaces } from "../src/spaces/extract-faces.js";
import {
  spaceId,
  validateCompleteSemanticSpacesV2,
  validateSemanticSpacesV1,
  type SemanticSpaceV1,
  type SemanticSpaceV2,
  type SemanticSpacesV1,
} from "../src/spaces/semantic-model.js";
import { twoRoomSharedWallTopology } from "./fixtures/topology.js";

function syntheticSpaces(): SemanticSpacesV1 {
  const faces = extractBoundedFaces(twoRoomSharedWallTopology()).faces;
  return {
    status: "active",
    modelVersion: 1,
    spaces: [
      { id: spaceId("s-west"), name: "West test space", category: "room", faceId: faces[0]!.id },
      { id: spaceId("s-east"), name: "East test space", category: "service", faceId: faces[1]!.id },
    ],
  };
}

function projectWithTestSpace() {
  const project = structuredClone(createOption3ProjectV2()) as any;
  if (project.topology.status !== "active") throw new Error("Option-3 test topology must be active.");
  const face = extractBoundedFaces(project.topology).faces[0]!;
  project.spaces = {
    status: "active",
    modelVersion: 2,
    spaces: [{
      id: spaceId("s-a3-1-fixture"),
      name: "A3.1 validation fixture",
      category: "other",
      architecturalRole: "unclassified",
      enclosure: "unclassified",
      faceId: face.id,
    }],
  };
  return project;
}

describe("A3.1 persistent semantic spaces", () => {
  it("keeps persistent SpaceId distinct from derived FaceId", () => {
    const model = validateSemanticSpacesV1(syntheticSpaces(), twoRoomSharedWallTopology());
    expect(model.spaces[0]!.id).toBe("s-west");
    expect(model.spaces[0]!.id).not.toBe(model.spaces[0]!.faceId);
    expect(() => spaceId(model.spaces[0]!.faceId)).toThrow("Invalid persistent space ID");
  });

  it("strictly validates the minimal active model and preserves stable IDs", () => {
    const source = syntheticSpaces();
    const first = validateSemanticSpacesV1(source, twoRoomSharedWallTopology());
    const second = validateSemanticSpacesV1(structuredClone(first), twoRoomSharedWallTopology());
    expect(second).toEqual(first);
    expect(second.spaces.map((space) => space.id)).toEqual(["s-west", "s-east"]);
  });

  it("rejects duplicate persistent IDs", () => {
    const invalid = structuredClone(syntheticSpaces()) as any;
    invalid.spaces[1].id = invalid.spaces[0].id;
    expect(() => validateSemanticSpacesV1(invalid, twoRoomSharedWallTopology()))
      .toThrow("duplicate space ID s-west");
  });

  it("rejects duplicate face bindings", () => {
    const invalid = structuredClone(syntheticSpaces()) as any;
    invalid.spaces[1].faceId = invalid.spaces[0].faceId;
    expect(() => validateSemanticSpacesV1(invalid, twoRoomSharedWallTopology()))
      .toThrow(/duplicate face binding f-[a-f0-9]{16}/);
  });

  it("rejects invalid categories and unknown fields", () => {
    const invalidCategory = structuredClone(syntheticSpaces()) as any;
    invalidCategory.spaces[0].category = "courtyard";
    expect(() => validateSemanticSpacesV1(invalidCategory, twoRoomSharedWallTopology()))
      .toThrow("must be one of room, circulation, service, storage, other");

    const unknownField = structuredClone(syntheticSpaces()) as any;
    unknownField.spaces[0].polygon = [];
    expect(() => validateSemanticSpacesV1(unknownField, twoRoomSharedWallTopology()))
      .toThrow("polygon is not supported");
  });

  it("rejects malformed and orphaned face bindings", () => {
    const malformed = structuredClone(syntheticSpaces()) as any;
    malformed.spaces[0].faceId = "not-a-face";
    expect(() => validateSemanticSpacesV1(malformed, twoRoomSharedWallTopology()))
      .toThrow("Invalid derived face ID");

    const orphaned = structuredClone(syntheticSpaces()) as any;
    orphaned.spaces[0].faceId = "f-0000000000000000";
    expect(() => validateSemanticSpacesV1(orphaned, twoRoomSharedWallTopology()))
      .toThrow("references orphaned derived face f-0000000000000000");
  });

  it("requires exclusive ownership of every bounded face at the A3-complete gate", () => {
    const topology = twoRoomSharedWallTopology();
    const complete = {
      status: "active",
      modelVersion: 2,
      spaces: syntheticSpaces().spaces.map((space) => ({
        ...space,
        architecturalRole: "ordinaryRoom",
        enclosure: "enclosedCovered",
      })),
    } as const;
    expect(validateCompleteSemanticSpacesV2(complete, topology).spaces).toHaveLength(2);

    const partial = { ...complete, spaces: [complete.spaces[0]!] };
    expect(() => validateCompleteSemanticSpacesV2(partial, topology)).toThrow(
      "does not claim every bounded face",
    );

    const unclassified = structuredClone(complete) as any;
    unclassified.spaces[0].architecturalRole = "unclassified";
    unclassified.spaces[0].enclosure = "unclassified";
    expect(() => validateCompleteSemanticSpacesV2(unclassified, topology)).toThrow(
      "is not A3-complete; unclassified spaces: s-west",
    );
  });

  it("round-trips an active semantic model without persisting face geometry", () => {
    const project = validateProjectV2(projectWithTestSpace());
    const recovered = parseProjectJson(serializeProject(project));
    expect(recovered.spaces).toEqual(project.spaces);
    expect(JSON.parse(serializeProject(project)).spaces.spaces[0]).toEqual({
      id: "s-a3-1-fixture",
      name: "A3.1 validation fixture",
      category: "other",
      architecturalRole: "unclassified",
      enclosure: "unclassified",
      faceId: project.spaces.status === "active" ? project.spaces.spaces[0]!.faceId : "unreachable",
    });
    expect(serializeProject(project)).not.toContain("areaUm2");
    expect(serializeProject(project)).not.toContain("vertices");
  });

  it("requires active topology for active spaces", () => {
    const invalid = projectWithTestSpace() as any;
    invalid.topology = { status: "deferred", targetStage: "A2", modelVersion: null, data: null };
    invalid.building.status = "topologyDeferred";
    expect(() => validateProjectV2(invalid)).toThrow("spaces cannot be active while project.topology is deferred");
  });

  it("migrates revision-3 files while preserving their deferred spaces meaning", () => {
    const revision3 = structuredClone(createOption3ProjectV2()) as any;
    revision3.schemaRevision = 3;
    revision3.spaces = { status: "deferred", targetStage: "A2", modelVersion: null, data: null };
    const migrated = parseProjectJson(JSON.stringify(revision3));
    expect(migrated.schemaRevision).toBe(6);
    expect(migrated.spaces).toEqual({ status: "deferred", targetStage: "A2", modelVersion: null, data: null });

    revision3.spaces = projectWithTestSpace().spaces;
    expect(() => parseProjectJson(JSON.stringify(revision3)))
      .toThrow('project.spaces.status must equal "deferred"');
  });

  it("preserves active face bindings when only legacy-reference rectangles change", () => {
    const project = validateProjectV2(projectWithTestSpace());
    const editedLegacy = structuredClone(project.legacyEditorState);
    editedLegacy.rooms[0]!.x += 1;
    const updated = updateProjectFromLegacyEditorState(project, editedLegacy);
    expect(updated.topology).toEqual(project.topology);
    expect(updated.spaces).toEqual(project.spaces);
  });

  it("preserves active spaces across non-geometry legacy presentation changes", () => {
    const project = validateProjectV2(projectWithTestSpace());
    const updatedLegacy = structuredClone(project.legacyEditorState);
    updatedLegacy.reference.opacity = 0.61;
    const updated = updateProjectFromLegacyEditorState(project, updatedLegacy);
    expect(updated.topology).toEqual(project.topology);
    expect(updated.spaces).toEqual(project.spaces);
  });

  it("migrates revision-4 active semantic spaces without changing stable bindings", () => {
    const revision4 = projectWithTestSpace();
    revision4.schemaRevision = 4;
    revision4.spaces = {
      status: "active",
      modelVersion: 1,
      spaces: revision4.spaces.spaces.map((space: SemanticSpaceV2): SemanticSpaceV1 => ({
        id: space.id,
        name: space.name,
        category: space.category,
        faceId: space.faceId,
      })),
    };
    const migrated = parseProjectJson(JSON.stringify(revision4));
    expect(migrated.schemaRevision).toBe(6);
    expect(migrated.spaces).toEqual({
      status: "active",
      modelVersion: 2,
      spaces: revision4.spaces.spaces.map((space: SemanticSpaceV1) => ({
        ...space,
        architecturalRole: "unclassified",
        enclosure: "unclassified",
      })),
    });
  });
});

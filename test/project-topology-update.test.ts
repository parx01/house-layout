import { describe, expect, it } from "vitest";
import { parseProjectJson, serializeProject } from "../src/persistence/project-storage.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import type { ProjectV2 } from "../src/project/schema.js";
import { applyTopologyMoveResult, ProjectTopologyUpdateError } from "../src/project/topology-update.js";
import { validateProjectV2 } from "../src/project/validation.js";
import { extractBoundedFaces } from "../src/spaces/extract-faces.js";
import { spaceId } from "../src/spaces/semantic-model.js";
import { moveWallPerpendicular } from "../src/topology/movement.js";
import { wallId, type TopologyV2 } from "../src/topology/model.js";
import { createTopologySvgRenderModel } from "../src/ui/topology-renderer.js";

type ActiveProject = ProjectV2 & { readonly topology: TopologyV2 };

function activeBaseline(): ActiveProject {
  const project = createOption3ProjectV2();
  if (project.topology.status !== "active") throw new Error("Option-3 topology must be active.");
  return project as ActiveProject;
}

function representativeMove() {
  const project = activeBaseline();
  return moveWallPerpendicular(project.topology, wallId("w-option3-front-wet-split-1"), 100_000);
}

function projectWithBoundSpace() {
  const project = structuredClone(activeBaseline()) as any;
  const face = extractBoundedFaces(project.topology).faces[0]!;
  project.spaces = {
    status: "active",
    modelVersion: 2,
    spaces: [{
      id: spaceId("s-authority-test"),
      name: "Authority transition fixture",
      category: "other",
      architecturalRole: "unclassified",
      enclosure: "unclassified",
      faceId: face.id,
    }],
  };
  return validateProjectV2(project);
}

describe("A2.6.1 canonical project topology updates", () => {
  it("validates, serializes, reloads, and renders a moved Option-3 topology", () => {
    const before = activeBaseline();
    const serializedBefore = JSON.stringify(before);
    const movement = representativeMove();

    const directCandidate = validateProjectV2({
      ...structuredClone(before),
      topology: movement.topology,
    });
    expect(directCandidate.topology).toEqual(movement.topology);

    const updated = applyTopologyMoveResult(before, movement);
    const recovered = parseProjectJson(serializeProject(updated));
    expect(recovered.topology).toEqual(movement.topology);
    expect(recovered.building.status).toBe("topologyActive");
    expect(recovered.legacyEditorState).toEqual(before.legacyEditorState);
    expect(JSON.stringify(before)).toBe(serializedBefore);

    if (recovered.topology.status !== "active") throw new Error("Recovered topology must be active.");
    const renderModel = createTopologySvgRenderModel(recovered.topology);
    expect(renderModel.faces).toHaveLength(13);
    expect(renderModel.walls).toHaveLength(41);
    expect(renderModel.junctions).toHaveLength(29);
  });

  it("preserves persistent semantic bindings when A2.5 preserves face IDs", () => {
    const before = projectWithBoundSpace();
    if (before.topology.status !== "active") throw new Error("Topology must be active.");
    const movement = moveWallPerpendicular(
      before.topology,
      wallId("w-option3-front-wet-split-1"),
      100_000,
    );
    const updated = applyTopologyMoveResult(before, movement);
    expect(updated.spaces).toEqual(before.spaces);
    expect(parseProjectJson(serializeProject(updated)).spaces).toEqual(before.spaces);
  });

  it("rejects a forged A2.5 result that replaces a wall identity", () => {
    const before = projectWithBoundSpace();
    if (before.topology.status !== "active" || before.spaces.status !== "active") {
      throw new Error("Active topology and spaces are required.");
    }
    const spaces = before.spaces;
    const boundFace = extractBoundedFaces(before.topology).faces.find(
      (face) => face.id === spaces.spaces[0]!.faceId,
    )!;
    const oldWallId = boundFace.boundary[0]!.wallId;
    const newWallId = wallId("w-authority-rekeyed");
    const changedTopology = structuredClone(before.topology) as any;
    const oldWall = changedTopology.walls[oldWallId];
    delete changedTopology.walls[oldWallId];
    changedTopology.walls[newWallId] = { ...oldWall, id: newWallId };

    const forgedResult = { ...representativeMove(), topology: changedTopology };
    expect(() => applyTopologyMoveResult(before, forgedResult)).toThrow(ProjectTopologyUpdateError);
    try {
      applyTopologyMoveResult(before, forgedResult);
      throw new Error("Expected semantic binding rejection.");
    } catch (error) {
      expect((error as ProjectTopologyUpdateError).stage).toBe("moveResult");
      expect((error as Error).message).toContain("must preserve every canonical node and wall ID");
    }
  });

  it("rejects A2.5 candidates whose wall band leaves the authoritative site", () => {
    const before = activeBaseline();
    if (before.topology.status !== "active") throw new Error("Topology must be active.");
    const movement = moveWallPerpendicular(
      before.topology,
      wallId("w-option3-left-outer-1"),
      -2_000_000,
    );
    expect(() => applyTopologyMoveResult(before, movement)).toThrow(/outside the current site boundary/);
    expect(before).toEqual(activeBaseline());
  });

  it("rejects incomplete movement metadata atomically", () => {
    const before = activeBaseline();
    const movement = representativeMove();
    const invalid = {
      ...movement,
      metadata: { ...movement.metadata, nodeChanges: [] },
    };
    expect(() => applyTopologyMoveResult(before, invalid)).toThrow("node-change metadata is incomplete");
    expect(before).toEqual(activeBaseline());
  });
});

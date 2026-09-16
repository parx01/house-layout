import { describe, expect, it } from "vitest";
import { parseProjectJson, serializeProject } from "../src/persistence/project-storage.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import { createOption3TopologyV2 } from "../src/project/option3-topology.js";
import {
  applyTopologyChangeResult,
  applyTopologyMoveTransaction,
} from "../src/project/topology-update.js";
import { validateA3CompleteProjectV2 } from "../src/project/validation.js";
import { deriveArchitecturalUnderstanding } from "../src/spaces/architectural-understanding.js";
import { extractBoundedFaces } from "../src/spaces/extract-faces.js";
import { getWallEndNode, getWallStartNode, wallId } from "../src/topology/model.js";
import { moveWallPerpendicular } from "../src/topology/movement.js";
import { splitWallAtPoint } from "../src/topology/operations.js";
import { coordinateUm } from "../src/core/units.js";

describe("A3.6 semantic-space closure", () => {
  it("fixes the complete curated Option-3 invariant without changing its topology", () => {
    const project = validateA3CompleteProjectV2(createOption3ProjectV2());
    if (project.topology.status !== "active" || project.spaces.status !== "active") {
      throw new Error("A3-complete baseline required.");
    }
    const faces = extractBoundedFaces(project.topology).faces;
    const understanding = deriveArchitecturalUnderstanding(project.topology, project.spaces);

    expect(faces).toHaveLength(13);
    expect(project.spaces.spaces).toHaveLength(13);
    expect(new Set(project.spaces.spaces.map((space) => space.id)).size).toBe(13);
    expect(new Set(project.spaces.spaces.map((space) => space.faceId)).size).toBe(13);
    expect(understanding.unclaimedFaceIds).toEqual([]);
    expect(project.spaces.spaces.every((space) =>
      space.architecturalRole !== "unclassified" && space.enclosure !== "unclassified")).toBe(true);
    expect(project.spaces.spaces.filter((space) => space.enclosure === "openToSky")).toEqual([]);
    expect(project.topology).toEqual(createOption3TopologyV2());
  });

  it("preserves identity and classification through move, rebind, understanding, and round-trip", () => {
    const original = validateA3CompleteProjectV2(createOption3ProjectV2());
    const originalTopology = structuredClone(original.topology);
    if (original.topology.status !== "active" || original.spaces.status !== "active") {
      throw new Error("A3-complete baseline required.");
    }
    const semanticIdentity = original.spaces.spaces.map((space) => ({
      id: space.id,
      category: space.category,
      architecturalRole: space.architecturalRole,
      enclosure: space.enclosure,
    }));

    const movement = moveWallPerpendicular(
      original.topology,
      wallId("w-option3-front-wet-split-1"),
      100_000,
    );
    const moved = applyTopologyMoveTransaction(original, movement);
    expect(moved.reconciliation.preservedBindings).toHaveLength(13);
    expect(moved.reconciliation.unclaimedFaceIds).toEqual([]);
    if (moved.project.topology.status !== "active" || moved.project.spaces.status !== "active") {
      throw new Error("Moved A3 project must remain active.");
    }
    const movedTopology = moved.project.topology;
    const movedSpaces = moved.project.spaces;

    const face = extractBoundedFaces(movedTopology).faces.find(
      (candidate) => candidate.id === movedSpaces.spaces[0]!.faceId,
    )!;
    const targetWallId = face.boundary[0]!.wallId;
    const start = getWallStartNode(movedTopology, targetWallId);
    const end = getWallEndNode(movedTopology, targetWallId);
    const split = splitWallAtPoint(
      movedTopology,
      targetWallId,
      {
        xUm: coordinateUm((start.xUm + end.xUm) / 2),
        yUm: coordinateUm((start.yUm + end.yUm) / 2),
      },
      { idSeed: "a3-closure-rebind" },
    );
    const changed = applyTopologyChangeResult(moved.project, split);
    expect(changed.status).toBe("committed");
    if (changed.status !== "committed") throw new Error("Safe wall split must commit.");
    expect(changed.reconciliation.reboundBindings).toHaveLength(1);
    expect(changed.reconciliation.unclaimedFaceIds).toEqual([]);

    const complete = validateA3CompleteProjectV2(changed.project);
    if (complete.topology.status !== "active" || complete.spaces.status !== "active") {
      throw new Error("Changed A3 project must remain complete.");
    }
    const understanding = deriveArchitecturalUnderstanding(complete.topology, complete.spaces);
    const serialized = serializeProject(complete);
    const recovered = validateA3CompleteProjectV2(parseProjectJson(serialized));
    if (recovered.topology.status !== "active" || recovered.spaces.status !== "active") {
      throw new Error("Recovered A3 project must remain complete.");
    }

    expect(recovered.spaces.spaces.map((space) => ({
      id: space.id,
      category: space.category,
      architecturalRole: space.architecturalRole,
      enclosure: space.enclosure,
    }))).toEqual(semanticIdentity);
    expect(deriveArchitecturalUnderstanding(recovered.topology, recovered.spaces)).toEqual(understanding);
    expect(serialized).not.toContain("centreLineAreaUm2");
    expect(serialized).not.toContain("clearAreaUm2");
    expect(serialized).not.toContain("labelAnchor");
    expect(original.topology).toEqual(originalTopology);
  });
});

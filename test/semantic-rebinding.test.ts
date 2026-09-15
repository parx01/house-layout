import { describe, expect, it } from "vitest";
import { coordinateUm } from "../src/core/units.js";
import { parseProjectJson, serializeProject } from "../src/persistence/project-storage.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import {
  applyTopologyChangeResult,
  applyTopologyMoveTransaction,
} from "../src/project/topology-update.js";
import { extractBoundedFaces } from "../src/spaces/extract-faces.js";
import { reconcileSemanticSpaces } from "../src/spaces/semantic-rebinding.js";
import { spaceId, type SemanticSpacesV1 } from "../src/spaces/semantic-model.js";
import { moveWallPerpendicular } from "../src/topology/movement.js";
import { getWallEndNode, getWallStartNode, wallId, type TopologyV2 } from "../src/topology/model.js";
import { insertWall, splitWallAtPoint } from "../src/topology/operations.js";
import { validateTopologyV2 } from "../src/topology/validation.js";
import { rectangleTopology, twoRoomSharedWallTopology } from "./fixtures/topology.js";

function spacesFor(topology: TopologyV2): SemanticSpacesV1 {
  return {
    status: "active",
    modelVersion: 1,
    spaces: extractBoundedFaces(topology).faces.map((face, index) => ({
      id: spaceId(`s-test-${index + 1}`),
      name: `Test ${index + 1}`,
      category: "other",
      faceId: face.id,
    })),
  };
}

function rekeyWall(topology: TopologyV2, oldIdentity: string, newIdentity: string): TopologyV2 {
  const candidate = structuredClone(topology) as any;
  const oldId = wallId(oldIdentity);
  const newId = wallId(newIdentity);
  const wall = candidate.walls[oldId];
  delete candidate.walls[oldId];
  candidate.walls[newId] = { ...wall, id: newId };
  return validateTopologyV2(candidate);
}

function rekeyAllWalls(topology: TopologyV2, suffix: string): TopologyV2 {
  const candidate = structuredClone(topology) as any;
  candidate.walls = Object.fromEntries(
    Object.values(candidate.walls).map((wall: any, index) => {
      const id = wallId(`w-${suffix}-${index + 1}`);
      return [id, { ...wall, id }];
    }),
  );
  return validateTopologyV2(candidate);
}

function setRectangleBounds(topology: TopologyV2, left: number, top: number, right: number, bottom: number): TopologyV2 {
  const candidate = structuredClone(topology) as any;
  candidate.nodes["n-1"] = { ...candidate.nodes["n-1"], xUm: coordinateUm(left), yUm: coordinateUm(top) };
  candidate.nodes["n-2"] = { ...candidate.nodes["n-2"], xUm: coordinateUm(right), yUm: coordinateUm(top) };
  candidate.nodes["n-3"] = { ...candidate.nodes["n-3"], xUm: coordinateUm(right), yUm: coordinateUm(bottom) };
  candidate.nodes["n-4"] = { ...candidate.nodes["n-4"], xUm: coordinateUm(left), yUm: coordinateUm(bottom) };
  return validateTopologyV2(candidate);
}

describe("A3.3 deterministic semantic rebinding", () => {
  it("preserves an unchanged FaceId across an ordinary resize", () => {
    const before = rectangleTopology();
    const after = moveWallPerpendicular(before, wallId("w-right"), 500_000).topology;
    const result = reconcileSemanticSpaces(spacesFor(before), before, after);
    expect(result.status).toBe("resolved");
    expect(result.report.preservedBindings).toHaveLength(1);
    expect(result.report.reboundBindings).toHaveLength(0);
  });

  it("rebinds a resized face after a wall ID replacement using exact one-to-one evidence", () => {
    const before = rectangleTopology();
    const resized = moveWallPerpendicular(before, wallId("w-right"), 500_000).topology;
    const after = rekeyWall(resized, "w-right", "w-right-replacement");
    const result = reconcileSemanticSpaces(spacesFor(before), before, after);
    expect(result.status).toBe("resolved");
    expect(result.report.reboundBindings).toHaveLength(1);
    expect(result.report.reboundBindings[0]!.evidence.previousFaceCoveragePpm).toBe(1_000_000);
    expect(result.report.reboundBindings[0]!.evidence.sharedBoundaryLengthUm).toBeGreaterThan(0);
  });

  it("rebinds a wall split that leaves the same physical space", () => {
    const before = rectangleTopology();
    const change = splitWallAtPoint(
      before,
      wallId("w-top"),
      { xUm: coordinateUm(2_000_000), yUm: coordinateUm(0) },
      { idSeed: "semantic-wall-split" },
    );
    const result = reconcileSemanticSpaces(spacesFor(before), before, change.topology);
    expect(result.status).toBe("resolved");
    expect(result.report.reboundBindings).toHaveLength(1);
    expect(result.report.reboundBindings[0]!.evidence.containment).toBe("sameGeometry");
    expect(result.report.unclaimedFaceIds).toEqual([]);
  });

  it("returns remapRequired for a face split and leaves both children unclaimed", () => {
    const before = rectangleTopology();
    const change = insertWall(
      before,
      {
        start: { xUm: coordinateUm(2_000_000), yUm: coordinateUm(0) },
        end: { xUm: coordinateUm(2_000_000), yUm: coordinateUm(3_000_000) },
        thicknessUm: before.walls[wallId("w-left")]!.thicknessUm,
      },
      { idSeed: "semantic-face-split" },
    );
    const result = reconcileSemanticSpaces(spacesFor(before), before, change.topology);
    expect(result.status).toBe("remapRequired");
    expect(result.report.unresolvedSpaces[0]).toMatchObject({ reason: "faceSplit" });
    expect(result.report.unresolvedSpaces[0]!.candidateFaceIds).toHaveLength(2);
    expect(result.report.newFaceIds).toHaveLength(2);
    expect(result.report.unclaimedFaceIds).toHaveLength(2);
  });

  it("returns remapRequired for a face merge without deleting either SpaceId", () => {
    const before = twoRoomSharedWallTopology();
    const after = structuredClone(before) as any;
    delete after.walls[wallId("w-shared")];
    const validatedAfter = validateTopologyV2(after);
    const result = reconcileSemanticSpaces(spacesFor(before), before, validatedAfter);
    expect(result.status).toBe("remapRequired");
    expect(result.report.unresolvedSpaces).toHaveLength(2);
    expect(result.report.unresolvedSpaces.map((entry) => entry.reason)).toEqual(["faceMerge", "faceMerge"]);
    expect(result.report.unresolvedSpaces.map((entry) => entry.spaceId)).toEqual(["s-test-1", "s-test-2"]);
  });

  it("distinguishes deleted/orphaned geometry from an ambiguous weak correspondence", () => {
    const before = rectangleTopology();
    const shifted = rekeyAllWalls(setRectangleBounds(before, 5_000_000, 0, 9_000_000, 3_000_000), "shifted");
    const orphaned = reconcileSemanticSpaces(spacesFor(before), before, shifted);
    expect(orphaned.status).toBe("remapRequired");
    expect(orphaned.report.unresolvedSpaces[0]!.reason).toBe("orphanedFace");

    const inset = rekeyAllWalls(setRectangleBounds(before, 500_000, 500_000, 3_500_000, 2_500_000), "inset");
    const ambiguous = reconcileSemanticSpaces(spacesFor(before), before, inset);
    expect(ambiguous.status).toBe("remapRequired");
    expect(ambiguous.report.unresolvedSpaces[0]!.reason).toBe("ambiguousCorrespondence");
  });

  it("is deterministic regardless of repeated evaluation", () => {
    const before = rectangleTopology();
    const after = rekeyWall(before, "w-top", "w-top-replacement");
    expect(reconcileSemanticSpaces(spacesFor(before), before, after)).toEqual(
      reconcileSemanticSpaces(spacesFor(before), before, after),
    );
  });
});

describe("A3.3 curated Option-3 project integration", () => {
  it("retains all 13 SpaceIds for a normal A2.5 movement and reports preserved bindings", () => {
    const before = createOption3ProjectV2();
    if (before.topology.status !== "active" || before.spaces.status !== "active") throw new Error("Active baseline required.");
    const movement = moveWallPerpendicular(before.topology, wallId("w-option3-front-wet-split-1"), 100_000);
    const result = applyTopologyMoveTransaction(before, movement);
    expect(result.reconciliation.preservedBindings).toHaveLength(13);
    expect(result.reconciliation.reboundBindings).toHaveLength(0);
    expect(result.project.spaces.status).toBe("active");
    if (result.project.spaces.status !== "active") throw new Error("Active spaces required.");
    expect(result.project.spaces.spaces.map((space) => space.id)).toEqual(before.spaces.spaces.map((space) => space.id));
  });

  it("commits an unambiguous Option-3 boundary-wall split, round-trips it, and preserves every SpaceId", () => {
    const before = createOption3ProjectV2();
    if (before.topology.status !== "active" || before.spaces.status !== "active") throw new Error("Active baseline required.");
    const boundFaceId = before.spaces.spaces[0]!.faceId;
    const targetFace = extractBoundedFaces(before.topology).faces.find((face) => face.id === boundFaceId)!;
    const targetWallId = targetFace.boundary[0]!.wallId;
    const start = getWallStartNode(before.topology, targetWallId);
    const end = getWallEndNode(before.topology, targetWallId);
    const change = splitWallAtPoint(
      before.topology,
      targetWallId,
      {
        xUm: coordinateUm((start.xUm + end.xUm) / 2),
        yUm: coordinateUm((start.yUm + end.yUm) / 2),
      },
      { idSeed: "option3-semantic-split" },
    );
    const result = applyTopologyChangeResult(before, change);
    expect(result.status).toBe("committed");
    if (result.status !== "committed" || result.project.spaces.status !== "active") throw new Error("Committed spaces required.");
    expect(result.reconciliation.reboundBindings).toHaveLength(1);
    expect(result.project.spaces.spaces.map((space) => space.id)).toEqual(before.spaces.spaces.map((space) => space.id));
    expect(parseProjectJson(serializeProject(result.project))).toEqual(result.project);
    expect(before).toEqual(createOption3ProjectV2());
  });

  it("returns an atomic remapRequired report when an Option-3 face is split", () => {
    const before = createOption3ProjectV2();
    const snapshot = structuredClone(before);
    if (before.topology.status !== "active") throw new Error("Active baseline required.");
    const change = insertWall(
      before.topology,
      {
        start: { xUm: coordinateUm(4_788_500), yUm: coordinateUm(16_500_000) },
        end: { xUm: coordinateUm(8_255_600), yUm: coordinateUm(16_500_000) },
        thicknessUm: before.topology.walls[wallId("w-option3-front-wet-split-1")]!.thicknessUm,
      },
      { idSeed: "option3-living-face-split" },
    );
    const result = applyTopologyChangeResult(before, change);
    expect(result.status).toBe("remapRequired");
    expect(result.reconciliation.unresolvedSpaces).toEqual([
      expect.objectContaining({ spaceId: "s-living-room", reason: "faceSplit" }),
    ]);
    expect(result.reconciliation.unclaimedFaceIds).toHaveLength(2);
    expect(before).toEqual(snapshot);
  });
});

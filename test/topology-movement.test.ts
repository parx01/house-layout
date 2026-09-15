import { describe, expect, it } from "vitest";
import { coordinateUm, lengthUm } from "../src/core/units.js";
import { createOption3TopologyV2, OPTION_3_TOPOLOGY_COORDINATES_UM } from "../src/project/option3-topology.js";
import { extractBoundedFaces } from "../src/spaces/extract-faces.js";
import {
  nodeId,
  wallId,
  WALL_THICKNESS_4_5_IN_UM,
  type NodeId,
  type TopologyNode,
  type TopologyV2,
  type TopologyWall,
  type WallId,
} from "../src/topology/model.js";
import { moveJunction, moveWallPerpendicular, TopologyMoveError } from "../src/topology/movement.js";
import { validateTopologyV2 } from "../src/topology/validation.js";
import { fourWayJunctionTopology, rectangleTopology, twoRoomSharedWallTopology } from "./fixtures/topology.js";

function point(xUm: number, yUm: number) {
  return { xUm: coordinateUm(xUm), yUm: coordinateUm(yUm) };
}

function topology(
  nodeValues: Array<[string, number, number]>,
  wallValues: Array<[string, string, string]>,
): TopologyV2 {
  const nodes = Object.fromEntries(nodeValues.map(([identity, xUm, yUm]) => {
    const id = nodeId(identity);
    return [id, { id, xUm: coordinateUm(xUm), yUm: coordinateUm(yUm) } satisfies TopologyNode];
  })) as Record<NodeId, TopologyNode>;
  const walls = Object.fromEntries(wallValues.map(([identity, start, end]) => {
    const id = wallId(identity);
    return [id, {
      id,
      startNodeId: nodeId(start),
      endNodeId: nodeId(end),
      thicknessUm: lengthUm(WALL_THICKNESS_4_5_IN_UM),
    } satisfies TopologyWall];
  })) as Record<WallId, TopologyWall>;
  return { status: "active", modelVersion: 1, nodes, walls };
}

function expectSameEntityIds(before: TopologyV2, after: TopologyV2): void {
  expect(Object.keys(after.nodes).sort()).toEqual(Object.keys(before.nodes).sort());
  expect(Object.keys(after.walls).sort()).toEqual(Object.keys(before.walls).sort());
  for (const id of Object.keys(before.walls) as WallId[]) {
    expect(after.walls[id]).toMatchObject({
      id,
      startNodeId: before.walls[id]!.startNodeId,
      endNodeId: before.walls[id]!.endNodeId,
      thicknessUm: before.walls[id]!.thicknessUm,
    });
  }
}

describe("A2.5 perpendicular wall movement", () => {
  it("moves a shared wall run atomically and resizes every connected perpendicular wall", () => {
    const before = twoRoomSharedWallTopology();
    const serializedBefore = JSON.stringify(before);
    const beforeFaceIds = extractBoundedFaces(before).faces.map((face) => face.id);
    const result = moveWallPerpendicular(before, wallId("w-shared"), 500_000);

    expect(JSON.stringify(before)).toBe(serializedBefore);
    expectSameEntityIds(before, result.topology);
    expect(result.topology.nodes[nodeId("n-2")]).toMatchObject(point(3_500_000, 0));
    expect(result.topology.nodes[nodeId("n-5")]).toMatchObject(point(3_500_000, 4_000_000));
    expect(result.metadata).toMatchObject({
      kind: "wallPerpendicular",
      wallId: wallId("w-shared"),
      orientation: "vertical",
      offsetUm: 500_000,
      wallRunIds: [wallId("w-shared")],
      translatedWallIds: [wallId("w-shared")],
      resizedWallIds: [
        wallId("w-bottom-left"), wallId("w-bottom-right"), wallId("w-top-left"), wallId("w-top-right"),
      ],
      preservedFaceIds: beforeFaceIds,
      faceCountBefore: 2,
      faceCountAfter: 2,
    });
    expect(result.metadata.nodeChanges.map((change) => change.nodeId)).toEqual([nodeId("n-2"), nodeId("n-5")]);
    expect(result.metadata.faceAreaChanges.map((change) => change.afterAreaUm2).sort((a, b) => a - b)).toEqual([
      10_000_000_000_000,
      14_000_000_000_000,
    ]);
    expect(extractBoundedFaces(result.topology).faces.map((face) => face.id)).toEqual(beforeFaceIds);
  });

  it("moves a horizontal wall perpendicular to itself", () => {
    const before = rectangleTopology();
    const result = moveWallPerpendicular(before, wallId("w-top"), 500_000);
    expect(result.metadata).toMatchObject({
      kind: "wallPerpendicular",
      orientation: "horizontal",
      offsetUm: 500_000,
      wallRunIds: [wallId("w-top")],
      translatedWallIds: [wallId("w-top")],
      resizedWallIds: [wallId("w-left"), wallId("w-right")],
      faceCountBefore: 1,
      faceCountAfter: 1,
    });
    expect(result.topology.nodes[nodeId("n-1")]).toMatchObject(point(0, 500_000));
    expect(result.topology.nodes[nodeId("n-2")]).toMatchObject(point(4_000_000, 500_000));
    expect(extractBoundedFaces(result.topology).faces[0]!.areaUm2).toBe(10_000_000_000_000);
  });

  it("moves every collinear segment in a run through an intermediate T-junction", () => {
    const source = topology(
      [
        ["n-top", 2_000_000, 0], ["n-tee", 2_000_000, 2_000_000], ["n-bottom", 2_000_000, 4_000_000],
        ["n-left-top", 0, 0], ["n-left-bottom", 0, 4_000_000], ["n-branch", 4_000_000, 2_000_000],
      ],
      [
        ["w-run-top", "n-top", "n-tee"], ["w-run-bottom", "n-tee", "n-bottom"],
        ["w-boundary-top", "n-left-top", "n-top"], ["w-boundary-left", "n-left-bottom", "n-left-top"],
        ["w-boundary-bottom", "n-bottom", "n-left-bottom"], ["w-branch", "n-tee", "n-branch"],
      ],
    );
    const result = moveWallPerpendicular(source, wallId("w-run-top"), 250_000);
    expect(result.metadata.kind).toBe("wallPerpendicular");
    if (result.metadata.kind !== "wallPerpendicular") throw new Error("unexpected metadata kind");
    expect(result.metadata.wallRunIds).toEqual([wallId("w-run-bottom"), wallId("w-run-top")]);
    expect(result.metadata.nodeChanges.map((change) => change.nodeId)).toEqual([
      nodeId("n-bottom"), nodeId("n-tee"), nodeId("n-top"),
    ]);
    expect(result.topology.nodes[nodeId("n-branch")]).toMatchObject(point(4_000_000, 2_000_000));
    expect(result.metadata.faceCountAfter).toBe(1);
    expect(validateTopologyV2(result.topology)).toEqual(result.topology);
  });
});

describe("A2.5 junction and corner movement", () => {
  it("moves a corner with minimal orthogonal coordinate propagation", () => {
    const before = rectangleTopology();
    const result = moveJunction(before, nodeId("n-1"), point(500_000, 500_000));

    expectSameEntityIds(before, result.topology);
    expect(result.topology.nodes[nodeId("n-1")]).toMatchObject(point(500_000, 500_000));
    expect(result.topology.nodes[nodeId("n-2")]).toMatchObject(point(4_000_000, 500_000));
    expect(result.topology.nodes[nodeId("n-4")]).toMatchObject(point(500_000, 3_000_000));
    expect(result.metadata).toMatchObject({
      kind: "junction",
      nodeId: nodeId("n-1"),
      target: point(500_000, 500_000),
      deltaXUm: 500_000,
      deltaYUm: 500_000,
      xConstraintNodeIds: [nodeId("n-1"), nodeId("n-4")],
      yConstraintNodeIds: [nodeId("n-1"), nodeId("n-2")],
      translatedWallIds: [],
      resizedWallIds: [wallId("w-bottom"), wallId("w-left"), wallId("w-right"), wallId("w-top")],
      faceCountBefore: 1,
      faceCountAfter: 1,
    });
    expect(extractBoundedFaces(result.topology).faces[0]!.areaUm2).toBe(8_750_000_000_000);
  });

  it("moves a T-junction while keeping both collinear continuations connected", () => {
    const before = twoRoomSharedWallTopology();
    const result = moveJunction(before, nodeId("n-2"), point(3_500_000, 500_000));

    expect(result.metadata.kind).toBe("junction");
    if (result.metadata.kind !== "junction") throw new Error("unexpected metadata kind");
    expect(result.metadata.xConstraintNodeIds).toEqual([nodeId("n-2"), nodeId("n-5")]);
    expect(result.metadata.yConstraintNodeIds).toEqual([nodeId("n-1"), nodeId("n-2"), nodeId("n-3")]);
    expect(result.topology.nodes[nodeId("n-1")]).toMatchObject(point(0, 500_000));
    expect(result.topology.nodes[nodeId("n-2")]).toMatchObject(point(3_500_000, 500_000));
    expect(result.topology.nodes[nodeId("n-3")]).toMatchObject(point(6_000_000, 500_000));
    expect(result.topology.nodes[nodeId("n-5")]).toMatchObject(point(3_500_000, 4_000_000));
    expect(result.metadata.faceCountAfter).toBe(2);
    expect(extractBoundedFaces(result.topology).faces.map((face) => face.id)).toEqual(
      extractBoundedFaces(before).faces.map((face) => face.id),
    );
  });

  it("moves a four-way junction with independent horizontal and vertical constraints", () => {
    const before = fourWayJunctionTopology();
    const result = moveJunction(before, nodeId("n-center"), point(250_000, 500_000));
    expect(result.metadata.kind).toBe("junction");
    if (result.metadata.kind !== "junction") throw new Error("unexpected metadata kind");
    expect(result.metadata.xConstraintNodeIds).toEqual([
      nodeId("n-center"), nodeId("n-north"), nodeId("n-south"),
    ]);
    expect(result.metadata.yConstraintNodeIds).toEqual([
      nodeId("n-center"), nodeId("n-east"), nodeId("n-west"),
    ]);
    expect(result.topology.nodes[nodeId("n-center")]).toMatchObject(point(250_000, 500_000));
    expect(result.topology.nodes[nodeId("n-north")]).toMatchObject(point(250_000, -1_000_000));
    expect(result.topology.nodes[nodeId("n-east")]).toMatchObject(point(1_000_000, 500_000));
    expect(result.metadata.faceCountBefore).toBe(0);
    expect(result.metadata.faceCountAfter).toBe(0);
    expectSameEntityIds(before, result.topology);
  });
});

describe("A2.5 rejection, atomicity, and determinism", () => {
  it("rejects a move that creates an unsplit crossing", () => {
    const before = topology(
      [
        ["n-1", 0, 0], ["n-2", 2_000_000, 0], ["n-3", 2_000_000, 4_000_000], ["n-4", 0, 4_000_000],
        ["n-a", 3_000_000, 2_000_000], ["n-b", 5_000_000, 2_000_000],
      ],
      [
        ["w-top", "n-1", "n-2"], ["w-right", "n-2", "n-3"], ["w-bottom", "n-3", "n-4"], ["w-left", "n-4", "n-1"],
        ["w-obstacle", "n-a", "n-b"],
      ],
    );
    expect(() => moveWallPerpendicular(before, wallId("w-right"), 2_000_000)).toThrow(/intersect without canonical splitting/i);
  });

  it("rejects a move that creates a collinear overlap", () => {
    const before = topology(
      [
        ["n-1", 0, 0], ["n-2", 2_000_000, 0], ["n-3", 2_000_000, 4_000_000], ["n-4", 0, 4_000_000],
        ["n-a", 3_000_000, 1_000_000], ["n-b", 3_000_000, 3_000_000],
      ],
      [
        ["w-top", "n-1", "n-2"], ["w-right", "n-2", "n-3"], ["w-bottom", "n-3", "n-4"], ["w-left", "n-4", "n-1"],
        ["w-obstacle", "n-a", "n-b"],
      ],
    );
    expect(() => moveWallPerpendicular(before, wallId("w-right"), 1_000_000)).toThrow(/overlap collinearly/i);
  });

  it("rejects face collapse and inversion even when the final graph remains orthogonal", () => {
    const before = rectangleTopology();
    expect(() => moveWallPerpendicular(before, wallId("w-left"), 4_000_000)).toThrow();
    try {
      moveWallPerpendicular(before, wallId("w-left"), 5_000_000);
      throw new Error("expected inversion rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(TopologyMoveError);
      expect((error as TopologyMoveError).stage).toBe("facePreservation");
      expect((error as Error).message).toMatch(/collapse, invert, or change its canonical boundary/i);
    }
  });

  it("leaves input byte-for-byte unchanged after every rejected candidate", () => {
    const before = rectangleTopology();
    const serialized = JSON.stringify(before);
    expect(() => moveWallPerpendicular(before, wallId("w-left"), 5_000_000)).toThrow();
    expect(JSON.stringify(before)).toBe(serialized);
    expect(() => moveJunction(before, nodeId("n-1"), point(4_000_000, 3_000_000))).toThrow();
    expect(JSON.stringify(before)).toBe(serialized);
  });

  it("rejects unsafe numeric input before constructing a candidate", () => {
    expect(() => moveWallPerpendicular(rectangleTopology(), wallId("w-left"), 0.5)).toThrow(/safe integer/i);
    expect(() => moveJunction(rectangleTopology(), nodeId("n-1"), {
      xUm: Number.MAX_SAFE_INTEGER + 1,
      yUm: coordinateUm(0),
    } as ReturnType<typeof point>)).toThrow(/safe integer/i);
  });

  it("produces identical topology and metadata regardless of record insertion order", () => {
    const source = twoRoomSharedWallTopology();
    const reordered: TopologyV2 = {
      ...source,
      nodes: Object.fromEntries(Object.entries(source.nodes).reverse()) as Record<NodeId, TopologyNode>,
      walls: Object.fromEntries(Object.entries(source.walls).reverse()) as Record<WallId, TopologyWall>,
    };
    expect(moveWallPerpendicular(reordered, wallId("w-shared"), 250_000)).toEqual(
      moveWallPerpendicular(source, wallId("w-shared"), 250_000),
    );
    expect(moveJunction(reordered, nodeId("n-2"), point(3_250_000, 250_000))).toEqual(
      moveJunction(source, nodeId("n-2"), point(3_250_000, 250_000)),
    );
  });
});

describe("A2.5 representative Option-3 movements", () => {
  it("moves a split shared wall run without changing the 13 canonical faces", () => {
    const before = createOption3TopologyV2();
    const result = moveWallPerpendicular(before, wallId("w-option3-front-wet-split-1"), 100_000);
    expect(result.metadata.kind).toBe("wallPerpendicular");
    if (result.metadata.kind !== "wallPerpendicular") throw new Error("unexpected metadata kind");
    expect(result.metadata.wallRunIds).toEqual([
      wallId("w-option3-front-wet-split-1"),
      wallId("w-option3-front-wet-split-2"),
    ]);
    expect(result.metadata.faceCountBefore).toBe(13);
    expect(result.metadata.faceCountAfter).toBe(13);
    expectSameEntityIds(before, result.topology);
    expect(validateTopologyV2(result.topology)).toEqual(result.topology);
  });

  it("moves a representative Option-3 T-junction in both axes transactionally", () => {
    const before = createOption3TopologyV2();
    const { x, y } = OPTION_3_TOPOLOGY_COORDINATES_UM;
    const result = moveJunction(
      before,
      nodeId("n-option3-front-wet-split-1"),
      point(x.frontPartitionLeft + 50_000, y.frontWetRoomSplit + 50_000),
    );
    expect(result.metadata.kind).toBe("junction");
    expect(result.metadata.faceCountBefore).toBe(13);
    expect(result.metadata.faceCountAfter).toBe(13);
    expect(result.topology.nodes[nodeId("n-option3-front-wet-split-1")]).toMatchObject(
      point(x.frontPartitionLeft + 50_000, y.frontWetRoomSplit + 50_000),
    );
    expectSameEntityIds(before, result.topology);
    expect(extractBoundedFaces(result.topology).faces.map((face) => face.id)).toEqual(
      extractBoundedFaces(before).faces.map((face) => face.id),
    );
  });
});

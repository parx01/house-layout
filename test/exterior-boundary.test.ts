import { describe, expect, it } from "vitest";
import { deriveExteriorBoundary } from "../src/building/exterior-boundary.js";
import { coordinateUm } from "../src/core/units.js";
import { createOption3TopologyV2 } from "../src/project/option3-topology.js";
import { moveJunction, moveWallPerpendicular } from "../src/topology/movement.js";
import { insertWall } from "../src/topology/operations.js";
import { nodeId, wallId, type NodeId, type TopologyNode, type TopologyV2, type TopologyWall, type WallId } from "../src/topology/model.js";
import { rectangleTopology, twoRoomSharedWallTopology } from "./fixtures/topology.js";

function addDetachedRectangle(topology: TopologyV2): TopologyV2 {
  const runs = [
    [6_000_000, 0, 8_000_000, 0],
    [8_000_000, 0, 8_000_000, 2_000_000],
    [8_000_000, 2_000_000, 6_000_000, 2_000_000],
    [6_000_000, 2_000_000, 6_000_000, 0],
  ] as const;
  let current = topology;
  for (const [index, [x1, y1, x2, y2]] of runs.entries()) {
    current = insertWall(current, {
      start: { xUm: coordinateUm(x1), yUm: coordinateUm(y1) },
      end: { xUm: coordinateUm(x2), yUm: coordinateUm(y2) },
      thicknessUm: topology.walls[wallId("w-left")]!.thicknessUm,
    }, { idSeed: `exterior-detached-${index + 1}` }).topology;
  }
  return current;
}

describe("A4-Core.1 derived exterior boundary", () => {
  it("classifies a simple perimeter and returns one ordered clockwise loop", () => {
    const topology = rectangleTopology();
    const result = deriveExteriorBoundary(topology);
    expect(result.exteriorWallIds).toEqual(["w-bottom", "w-left", "w-right", "w-top"]);
    expect(result.internalSharedWallIds).toEqual([]);
    expect(result.nonFaceBoundaryWallIds).toEqual([]);
    expect(result.loops).toHaveLength(1);
    expect(result.loops[0]!.boundary).toHaveLength(4);
    expect(result.loops[0]!.vertices.map((vertex) => vertex.nodeId)).toEqual(["n-3", "n-4", "n-1", "n-2"]);
  });

  it("classifies the shared wall between adjacent faces as internal", () => {
    const result = deriveExteriorBoundary(twoRoomSharedWallTopology());
    expect(result.internalSharedWallIds).toEqual(["w-shared"]);
    expect(result.exteriorWallIds).not.toContain("w-shared");
    expect(result.exteriorWallIds).toEqual([
      "w-bottom-left", "w-bottom-right", "w-left", "w-right", "w-top-left", "w-top-right",
    ]);
    expect(result.loops[0]!.boundary).toHaveLength(6);
  });

  it("keeps a dangling bridge explicit instead of misclassifying it as exterior", () => {
    const change = insertWall(rectangleTopology(), {
      start: { xUm: coordinateUm(2_000_000), yUm: coordinateUm(0) },
      end: { xUm: coordinateUm(2_000_000), yUm: coordinateUm(1_000_000) },
      thicknessUm: rectangleTopology().walls[wallId("w-left")]!.thicknessUm,
    }, { idSeed: "exterior-dangling" });
    const result = deriveExteriorBoundary(change.topology);
    expect(result.nonFaceBoundaryWallIds).toEqual(change.insertedWallIds);
    expect(result.exteriorWallIds.some((identity) => change.insertedWallIds.includes(identity))).toBe(false);
  });

  it("derives deterministic loops for separate non-overlapping enclosed components", () => {
    const topology = addDetachedRectangle(rectangleTopology());
    const first = deriveExteriorBoundary(topology);
    const reordered: TopologyV2 = {
      ...topology,
      nodes: Object.fromEntries(Object.entries(topology.nodes).reverse()) as Record<NodeId, TopologyNode>,
      walls: Object.fromEntries(Object.entries(topology.walls).reverse()) as Record<WallId, TopologyWall>,
    };
    expect(first.loops).toHaveLength(2);
    expect(first.exteriorWallIds).toHaveLength(8);
    expect(deriveExteriorBoundary(reordered)).toEqual(first);
  });

  it("preserves classification and ordered boundary identity after a valid shared-wall move", () => {
    const before = twoRoomSharedWallTopology();
    const after = moveWallPerpendicular(before, wallId("w-shared"), 250_000).topology;
    const beforeBoundary = deriveExteriorBoundary(before);
    const afterBoundary = deriveExteriorBoundary(after);
    expect(afterBoundary.exteriorWallIds).toEqual(beforeBoundary.exteriorWallIds);
    expect(afterBoundary.internalSharedWallIds).toEqual(beforeBoundary.internalSharedWallIds);
    expect(afterBoundary.loops.map((loop) => loop.boundary)).toEqual(
      beforeBoundary.loops.map((loop) => loop.boundary),
    );
  });

  it("preserves classification and ordered boundary identity after a valid junction move", () => {
    const before = rectangleTopology();
    const after = moveJunction(before, nodeId("n-1"), {
      xUm: coordinateUm(500_000),
      yUm: coordinateUm(500_000),
    }).topology;
    const beforeBoundary = deriveExteriorBoundary(before);
    const afterBoundary = deriveExteriorBoundary(after);
    expect(afterBoundary.exteriorWallIds).toEqual(beforeBoundary.exteriorWallIds);
    expect(afterBoundary.internalSharedWallIds).toEqual(beforeBoundary.internalSharedWallIds);
    expect(afterBoundary.loops.map((loop) => loop.boundary)).toEqual(
      beforeBoundary.loops.map((loop) => loop.boundary),
    );
    expect(afterBoundary.loops[0]!.vertices).not.toEqual(beforeBoundary.loops[0]!.vertices);
  });

  it("classifies the curated Option-3 perimeter independently of semantic spaces", () => {
    const topology = createOption3TopologyV2();
    const result = deriveExteriorBoundary(topology);
    expect(result.loops).toHaveLength(1);
    expect(result.nonFaceBoundaryWallIds).toEqual([]);
    expect(result.exteriorWallIds).toHaveLength(16);
    expect(result.internalSharedWallIds).toHaveLength(25);
    expect(result.exteriorWallIds).toContain("w-option3-left-outer-1");
    expect(result.exteriorWallIds).toContain("w-option3-stair-outer-1");
    expect(result.internalSharedWallIds).toContain("w-option3-front-wet-split-1");
    expect(result.exteriorWallIds).not.toContain("w-option3-front-wet-split-1");
    expect(result.loops[0]!.boundary).toEqual([
      { wallId: "w-option3-central-front-1", direction: "forward" },
      { wallId: "w-option3-central-front-2", direction: "forward" },
      { wallId: "w-option3-front-partition-right-4", direction: "reverse" },
      { wallId: "w-option3-front-partition-right-3", direction: "reverse" },
      { wallId: "w-option3-front-partition-left-3", direction: "reverse" },
      { wallId: "w-option3-central-step-3", direction: "reverse" },
      { wallId: "w-option3-stair-outer-1", direction: "reverse" },
      { wallId: "w-option3-kitchen-stair-4", direction: "reverse" },
      { wallId: "w-option3-kitchen-stair-3", direction: "reverse" },
      { wallId: "w-option3-puja-kitchen-1", direction: "reverse" },
      { wallId: "w-option3-left-outer-1", direction: "reverse" },
      { wallId: "w-option3-rear-partition-left-3", direction: "forward" },
      { wallId: "w-option3-rear-partition-middle-3", direction: "forward" },
      { wallId: "w-option3-rear-partition-right-3", direction: "forward" },
      { wallId: "w-option3-rear-partition-right-4", direction: "forward" },
      { wallId: "w-option3-rear-central-1", direction: "forward" },
    ]);
  });

  it("remains correct after a representative valid Option-3 movement", () => {
    const topology = createOption3TopologyV2();
    const moved = moveWallPerpendicular(topology, wallId("w-option3-front-wet-split-1"), 100_000).topology;
    const before = deriveExteriorBoundary(topology);
    const after = deriveExteriorBoundary(moved);
    expect(after.exteriorWallIds).toEqual(before.exteriorWallIds);
    expect(after.internalSharedWallIds).toEqual(before.internalSharedWallIds);
    expect(after.loops.map((loop) => loop.boundary)).toEqual(before.loops.map((loop) => loop.boundary));
  });
});

import { describe, expect, it } from "vitest";
import { coordinateUm, lengthUm } from "../src/core/units.js";
import {
  createEmptyTopologyV2,
  getConnectedWallIds,
  nodeId,
  WALL_THICKNESS_4_5_IN_UM,
  wallId,
  type NodeId,
  type TopologyNode,
  type TopologyV2,
  type TopologyWall,
  type WallId,
} from "../src/topology/model.js";
import {
  findNodeAtCoordinate,
  findWallIntersections,
  getWallsAtNode,
  insertWall,
  splitWallAtPoint,
  type TopologyPoint,
  type WallProposal,
} from "../src/topology/operations.js";
import { validateTopologyV2 } from "../src/topology/validation.js";

const THICKNESS = WALL_THICKNESS_4_5_IN_UM;

function point(xUm: number, yUm: number): TopologyPoint {
  return { xUm: coordinateUm(xUm), yUm: coordinateUm(yUm) };
}

function proposal(x1: number, y1: number, x2: number, y2: number): WallProposal {
  return { start: point(x1, y1), end: point(x2, y2), thicknessUm: THICKNESS };
}

function topology(
  nodeValues: Array<[string, number, number]>,
  wallValues: Array<[string, string, string]>,
): TopologyV2 {
  const nodes = Object.fromEntries(nodeValues.map(([idValue, xUm, yUm]) => {
    const id = nodeId(idValue);
    return [id, { id, xUm: coordinateUm(xUm), yUm: coordinateUm(yUm) } satisfies TopologyNode];
  })) as Record<NodeId, TopologyNode>;
  const walls = Object.fromEntries(wallValues.map(([idValue, startValue, endValue]) => {
    const id = wallId(idValue);
    return [id, {
      id,
      startNodeId: nodeId(startValue),
      endNodeId: nodeId(endValue),
      thicknessUm: lengthUm(THICKNESS),
    } satisfies TopologyWall];
  })) as Record<WallId, TopologyWall>;
  return { status: "active", modelVersion: 1, nodes, walls };
}

function singleHorizontalWall(): TopologyV2 {
  return topology(
    [["n-left", 0, 0], ["n-right", 10_000_000, 0]],
    [["w-existing", "n-left", "n-right"]],
  );
}

function insert(
  value: TopologyV2,
  segment: WallProposal,
  idSeed: string,
): ReturnType<typeof insertWall> {
  return insertWall(value, segment, { idSeed });
}

describe("A2.2 intersection classification and insertion", () => {
  it("creates a canonical T-junction when a new endpoint meets a wall interior", () => {
    const before = singleHorizontalWall();
    expect(findWallIntersections(before, proposal(5_000_000, 0, 5_000_000, 4_000_000))).toEqual([
      {
        kind: "proposedEndpointToExistingInterior",
        wallId: wallId("w-existing"),
        point: point(5_000_000, 0),
      },
    ]);

    const change = insert(before, proposal(5_000_000, 0, 5_000_000, 4_000_000), "tee");
    const junction = findNodeAtCoordinate(change.topology, point(5_000_000, 0))!;
    expect(getConnectedWallIds(change.topology, junction.id)).toHaveLength(3);
    expect(change.removedWallIds).toEqual([wallId("w-existing")]);
    expect(change.wallReplacements).toEqual({
      "w-existing": [wallId("w-tee-1"), wallId("w-tee-2")],
    });
    expect(change.insertedWallIds).toEqual([wallId("w-tee-3")]);
    expect(validateTopologyV2(change.topology)).toEqual(change.topology);
  });

  it("creates one shared degree-4 node for an X-intersection", () => {
    const segment = proposal(5_000_000, -4_000_000, 5_000_000, 4_000_000);
    expect(findWallIntersections(singleHorizontalWall(), segment)[0]?.kind).toBe("interiorCrossing");
    const change = insert(singleHorizontalWall(), segment, "cross");
    const crossing = findNodeAtCoordinate(change.topology, point(5_000_000, 0))!;
    expect(getWallsAtNode(change.topology, crossing.id)).toHaveLength(4);
    expect(change.wallReplacements["w-existing"]).toHaveLength(2);
    expect(change.insertedWallIds).toHaveLength(2);
  });

  it("splits a new wall at every perpendicular intersection in coordinate order", () => {
    const before = topology(
      [
        ["n-a1", 0, 0], ["n-a2", 10_000_000, 0],
        ["n-b1", 0, 6_000_000], ["n-b2", 10_000_000, 6_000_000],
        ["n-c1", 0, 12_000_000], ["n-c2", 10_000_000, 12_000_000],
      ],
      [
        ["w-a", "n-a1", "n-a2"],
        ["w-b", "n-b1", "n-b2"],
        ["w-c", "n-c1", "n-c2"],
      ],
    );
    const change = insert(before, proposal(5_000_000, -2_000_000, 5_000_000, 14_000_000), "multi");
    expect(change.removedWallIds).toEqual([wallId("w-a"), wallId("w-b"), wallId("w-c")]);
    expect(change.insertedWallIds).toHaveLength(4);
    expect(change.insertedWallIds).toEqual([
      wallId("w-multi-7"), wallId("w-multi-8"), wallId("w-multi-9"), wallId("w-multi-10"),
    ]);
  });

  it("reuses an existing canonical node at an intersection", () => {
    const before = topology(
      [["n-left", 0, 0], ["n-middle", 5_000_000, 0], ["n-right", 10_000_000, 0]],
      [["w-left-half", "n-left", "n-middle"], ["w-right-half", "n-middle", "n-right"]],
    );
    const change = insert(before, proposal(5_000_000, 0, 5_000_000, 4_000_000), "reuse");
    expect(change.createdNodeIds).not.toContain(nodeId("n-middle"));
    expect(findNodeAtCoordinate(change.topology, point(5_000_000, 0))?.id).toBe(nodeId("n-middle"));
    expect(getWallsAtNode(change.topology, nodeId("n-middle"))).toHaveLength(3);
  });

  it("reuses nodes for endpoint-to-endpoint connections and straight continuations", () => {
    const before = topology(
      [["n-left", 0, 0], ["n-right", 5_000_000, 0]],
      [["w-existing", "n-left", "n-right"]],
    );
    const perpendicularProposal = proposal(5_000_000, 0, 5_000_000, 3_000_000);
    expect(findWallIntersections(before, perpendicularProposal)[0]?.kind).toBe("endpointEndpoint");
    const perpendicular = insert(before, perpendicularProposal, "endpoint");
    expect(perpendicular.createdNodeIds).toHaveLength(1);
    expect(getWallsAtNode(perpendicular.topology, nodeId("n-right"))).toHaveLength(2);

    const continuation = insert(before, proposal(5_000_000, 0, 8_000_000, 0), "continue");
    expect(continuation.createdNodeIds).toHaveLength(1);
    expect(getWallsAtNode(continuation.topology, nodeId("n-right"))).toHaveLength(2);
  });

  it("splits the new wall when it passes through an existing wall endpoint", () => {
    const before = topology(
      [["n-left", 0, 0], ["n-right", 5_000_000, 0]],
      [["w-existing", "n-left", "n-right"]],
    );
    const segment = proposal(5_000_000, -3_000_000, 5_000_000, 3_000_000);
    expect(findWallIntersections(before, segment)[0]?.kind).toBe("existingEndpointToProposedInterior");
    const change = insert(before, segment, "endpoint-interior");
    expect(change.removedWallIds).toEqual([]);
    expect(change.insertedWallIds).toHaveLength(2);
    expect(getWallsAtNode(change.topology, nodeId("n-right"))).toHaveLength(3);
  });

  it("produces identical canonical output for reversed insertion direction", () => {
    const forward = insert(singleHorizontalWall(), proposal(5_000_000, -4_000_000, 5_000_000, 4_000_000), "direction");
    const reversed = insert(singleHorizontalWall(), proposal(5_000_000, 4_000_000, 5_000_000, -4_000_000), "direction");
    expect(reversed).toEqual(forward);
  });
});

describe("A2.2 rejection and atomicity", () => {
  it("rejects exact and reversed duplicate insertion", () => {
    expect(() => insert(singleHorizontalWall(), proposal(0, 0, 10_000_000, 0), "duplicate")).toThrow(
      "Proposed wall duplicates topology wall w-existing",
    );
    expect(() => insert(singleHorizontalWall(), proposal(10_000_000, 0, 0, 0), "duplicate")).toThrow(
      "Proposed wall duplicates topology wall w-existing",
    );
  });

  it("rejects partial and containing collinear overlap", () => {
    expect(() => insert(singleHorizontalWall(), proposal(5_000_000, 0, 15_000_000, 0), "partial")).toThrow(
      "overlaps collinearly",
    );
    expect(() => insert(singleHorizontalWall(), proposal(-5_000_000, 0, 15_000_000, 0), "full")).toThrow(
      "overlaps collinearly",
    );
  });

  it("rejects zero-length and diagonal proposals", () => {
    expect(() => insert(singleHorizontalWall(), proposal(2_000_000, 2_000_000, 2_000_000, 2_000_000), "zero")).toThrow(
      "must not be zero-length",
    );
    expect(() => insert(singleHorizontalWall(), proposal(0, 1_000_000, 2_000_000, 2_000_000), "diagonal")).toThrow(
      "must be horizontal or vertical",
    );
  });

  it("leaves the input byte-for-byte unchanged when an operation fails", () => {
    const before = singleHorizontalWall();
    const serializedBefore = JSON.stringify(before);
    expect(() => insert(before, proposal(2_000_000, 0, 8_000_000, 0), "atomic")).toThrow();
    expect(JSON.stringify(before)).toBe(serializedBefore);
  });

  it("rejects committed collinear overlaps and unsplit crossings", () => {
    const overlap = topology(
      [["n-a", 0, 0], ["n-b", 6_000_000, 0], ["n-c", 4_000_000, 0], ["n-d", 8_000_000, 0]],
      [["w-a", "n-a", "n-b"], ["w-b", "n-c", "n-d"]],
    );
    expect(() => validateTopologyV2(overlap)).toThrow("overlap collinearly");

    const crossing = topology(
      [["n-left", 0, 0], ["n-right", 8_000_000, 0], ["n-top", 4_000_000, -2_000_000], ["n-bottom", 4_000_000, 2_000_000]],
      [["w-horizontal", "n-left", "n-right"], ["w-vertical", "n-top", "n-bottom"]],
    );
    expect(() => validateTopologyV2(crossing)).toThrow("intersect without canonical splitting");
  });

  it("rejects non-deterministic or unsafe operation inputs", () => {
    expect(() => insert(singleHorizontalWall(), proposal(0, 1, 10_000_000, 1), "bad seed")).toThrow(/idSeed/);
    const unsafe = {
      start: { xUm: 0, yUm: 1 },
      end: { xUm: Number.MAX_SAFE_INTEGER + 1, yUm: 1 },
      thicknessUm: THICKNESS,
    } as WallProposal;
    expect(() => insert(singleHorizontalWall(), unsafe, "unsafe")).toThrow(/safe integers/);
  });
});

describe("A2.2 splitting, combined graph, and persistence", () => {
  it("splits one wall atomically and returns deterministic replacements", () => {
    const change = splitWallAtPoint(singleHorizontalWall(), wallId("w-existing"), point(4_000_000, 0), { idSeed: "split" });
    expect(change.createdNodeIds).toEqual([nodeId("n-split-1")]);
    expect(change.removedWallIds).toEqual([wallId("w-existing")]);
    expect(change.wallReplacements).toEqual({
      "w-existing": [wallId("w-split-1"), wallId("w-split-2")],
    });
    expect(validateTopologyV2(change.topology)).toEqual(change.topology);
  });

  it("never recycles a removed wall ID within the splitting transaction", () => {
    const before = topology(
      [["n-left", 0, 0], ["n-right", 10_000_000, 0]],
      [["w-collision-1", "n-left", "n-right"]],
    );
    const change = splitWallAtPoint(before, wallId("w-collision-1"), point(4_000_000, 0), { idSeed: "collision" });
    expect(change.wallReplacements["w-collision-1"]).toEqual([
      wallId("w-collision-2"), wallId("w-collision-3"),
    ]);
    expect(change.createdWallIds).not.toContain(wallId("w-collision-1"));
  });

  it("constructs a canonical orthogonal four-cell grid", () => {
    let graph = createEmptyTopologyV2();
    graph = insert(graph, proposal(0, 0, 8_000_000, 0), "grid-top").topology;
    graph = insert(graph, proposal(8_000_000, 0, 8_000_000, 6_000_000), "grid-right").topology;
    graph = insert(graph, proposal(0, 6_000_000, 8_000_000, 6_000_000), "grid-bottom").topology;
    graph = insert(graph, proposal(0, 0, 0, 6_000_000), "grid-left").topology;
    graph = insert(graph, proposal(4_000_000, 0, 4_000_000, 6_000_000), "grid-vertical").topology;
    graph = insert(graph, proposal(0, 3_000_000, 8_000_000, 3_000_000), "grid-horizontal").topology;

    const centre = findNodeAtCoordinate(graph, point(4_000_000, 3_000_000))!;
    expect(Object.keys(graph.nodes)).toHaveLength(9);
    expect(Object.keys(graph.walls)).toHaveLength(12);
    expect(getWallsAtNode(graph, centre.id)).toHaveLength(4);
    expect(validateTopologyV2(graph)).toEqual(graph);
  });

  it("survives a JSON round-trip after intersection splitting", () => {
    const graph = insert(singleHorizontalWall(), proposal(5_000_000, -4_000_000, 5_000_000, 4_000_000), "persist").topology;
    const recovered = validateTopologyV2(JSON.parse(JSON.stringify(graph)));
    expect(recovered).toEqual(graph);
  });
});

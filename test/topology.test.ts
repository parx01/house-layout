import { describe, expect, it } from "vitest";
import {
  createEmptyTopologyV2,
  getConnectedWallIds,
  getWallEndNode,
  getWallLength,
  getWallOrientation,
  getWallStartNode,
  nodeId,
  WALL_THICKNESS_4_5_IN_UM,
  WALL_THICKNESS_9_IN_UM,
  wallId,
} from "../src/topology/model.js";
import { validateTopologyV2 } from "../src/topology/validation.js";
import { fourWayJunctionTopology, rectangleTopology, twoRoomSharedWallTopology } from "./fixtures/topology.js";

function rawClone(value: unknown): any {
  return structuredClone(value);
}

describe("canonical topology validation", () => {
  it("provides exact integer architectural thickness constants", () => {
    expect(WALL_THICKNESS_4_5_IN_UM).toBe(114_300);
    expect(WALL_THICKNESS_9_IN_UM).toBe(228_600);
  });

  it("validates an empty topology", () => {
    expect(validateTopologyV2(createEmptyTopologyV2())).toEqual(createEmptyTopologyV2());
  });

  it("validates a simple rectangle", () => {
    expect(validateTopologyV2(rectangleTopology())).toEqual(rectangleTopology());
  });

  it("represents two rooms with exactly one shared canonical wall", () => {
    const topology = validateTopologyV2(twoRoomSharedWallTopology());
    expect(Object.keys(topology.walls)).toHaveLength(7);
    expect(Object.values(topology.walls).filter((wall) =>
      new Set([wall.startNodeId, wall.endNodeId]).has(nodeId("n-2")) &&
      new Set([wall.startNodeId, wall.endNodeId]).has(nodeId("n-5")),
    ).map((wall) => wall.id)).toEqual([wallId("w-shared")]);
  });

  it("supports nodes connected to two, three, or four walls", () => {
    expect(getConnectedWallIds(rectangleTopology(), nodeId("n-1"))).toHaveLength(2);
    expect(getConnectedWallIds(twoRoomSharedWallTopology(), nodeId("n-2"))).toHaveLength(3);
    expect(getConnectedWallIds(fourWayJunctionTopology(), nodeId("n-center"))).toHaveLength(4);
  });

  it("rejects a missing node reference with the wall ID", () => {
    const topology = rawClone(rectangleTopology());
    topology.walls["w-top"].endNodeId = "n-missing";
    expect(() => validateTopologyV2(topology)).toThrow("Topology wall w-top references missing end node n-missing");
  });

  it("rejects a wall that uses the same node for both endpoints", () => {
    const topology = rawClone(rectangleTopology());
    topology.walls["w-top"].endNodeId = "n-1";
    expect(() => validateTopologyV2(topology)).toThrow("Topology wall w-top uses node n-1 for both endpoints");
  });

  it("rejects a geometrically zero-length wall", () => {
    const topology = rawClone(rectangleTopology());
    topology.nodes["n-zero"] = { id: "n-zero", xUm: 0, yUm: 0 };
    topology.walls["w-zero"] = { id: "w-zero", startNodeId: "n-1", endNodeId: "n-zero", thicknessUm: 114_300 };
    expect(() => validateTopologyV2(topology)).toThrow("Topology wall w-zero is geometrically zero-length");
  });

  it("rejects a diagonal wall without snapping", () => {
    const topology = rawClone(rectangleTopology());
    topology.nodes["n-2"].yUm = 1;
    expect(() => validateTopologyV2(topology)).toThrow("Topology wall w-top is diagonal");
  });

  it("rejects duplicate and reversed physical wall segments", () => {
    const duplicate = rawClone(rectangleTopology());
    duplicate.walls["w-copy"] = { ...duplicate.walls["w-top"], id: "w-copy" };
    expect(() => validateTopologyV2(duplicate)).toThrow("Topology wall w-copy duplicates physical segment w-top");

    const reversed = rawClone(rectangleTopology());
    reversed.walls["w-reversed"] = {
      ...reversed.walls["w-top"],
      id: "w-reversed",
      startNodeId: "n-2",
      endNodeId: "n-1",
    };
    expect(() => validateTopologyV2(reversed)).toThrow("Topology wall w-reversed duplicates physical segment w-top");
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid wall thickness %s", (thicknessUm) => {
    const topology = rawClone(rectangleTopology());
    topology.walls["w-top"].thicknessUm = thicknessUm;
    expect(() => validateTopologyV2(topology)).toThrow(/thicknessUm/);
  });

  it("rejects duplicate node entity IDs", () => {
    const topology = rawClone(rectangleTopology());
    topology.nodes["n-alias"] = { ...topology.nodes["n-1"] };
    expect(() => validateTopologyV2(topology)).toThrow("Duplicate topology node ID n-1");
  });

  it("rejects duplicate wall entity IDs", () => {
    const topology = rawClone(rectangleTopology());
    topology.walls["w-alias"] = { ...topology.walls["w-top"] };
    expect(() => validateTopologyV2(topology)).toThrow("Duplicate topology wall ID w-top");
  });

  it("rejects coincident independent nodes in committed topology", () => {
    const topology = rawClone(rectangleTopology());
    topology.nodes["n-coincident"] = { id: "n-coincident", xUm: 0, yUm: 0 };
    expect(() => validateTopologyV2(topology)).toThrow("Topology node n-coincident is coincident with disconnected node n-1");
  });

  it.each([1.5, Number.MAX_SAFE_INTEGER + 1])("rejects unsafe or non-integer coordinates %s", (xUm) => {
    const topology = rawClone(rectangleTopology());
    topology.nodes["n-1"].xUm = xUm;
    expect(() => validateTopologyV2(topology)).toThrow(/n-1.*xUm.*safe integer/);
  });
});

describe("derived topology helpers", () => {
  it("resolves wall endpoint nodes by stable ID", () => {
    const topology = rectangleTopology();
    expect(getWallStartNode(topology, wallId("w-top")).id).toBe(nodeId("n-1"));
    expect(getWallEndNode(topology, wallId("w-top")).id).toBe(nodeId("n-2"));
  });

  it("derives horizontal and vertical orientation from canonical nodes", () => {
    const topology = rectangleTopology();
    expect(getWallOrientation(topology, wallId("w-top"))).toBe("horizontal");
    expect(getWallOrientation(topology, wallId("w-left"))).toBe("vertical");
  });

  it("derives exact wall length from canonical nodes", () => {
    const topology = rectangleTopology();
    expect(getWallLength(topology, wallId("w-top"))).toBe(4_000_000);
    expect(getWallLength(topology, wallId("w-left"))).toBe(3_000_000);
  });

  it("finds connected wall IDs through shared node identity", () => {
    expect(getConnectedWallIds(twoRoomSharedWallTopology(), nodeId("n-2"))).toEqual([
      wallId("w-top-left"),
      wallId("w-top-right"),
      wallId("w-shared"),
    ]);
  });
});

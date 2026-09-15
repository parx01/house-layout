import { describe, expect, it } from "vitest";
import { coordinateUm, lengthUm } from "../src/core/units.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import { createOption3TopologyV2 } from "../src/project/option3-topology.js";
import { extractBoundedFaces, FaceExtractionError } from "../src/spaces/extract-faces.js";
import type { DerivedBoundedFace } from "../src/spaces/model.js";
import {
  getWallEndNode,
  getWallStartNode,
  nodeId,
  wallId,
  type NodeId,
  type TopologyNode,
  type TopologyV2,
  type TopologyWall,
  type WallId,
} from "../src/topology/model.js";
import { insertWall, splitWallAtPoint } from "../src/topology/operations.js";
import { rectangleTopology, twoRoomSharedWallTopology } from "./fixtures/topology.js";

const THICKNESS_UM = lengthUm(114_300);

function assertCanonicalFace(topology: TopologyV2, face: DerivedBoundedFace): void {
  expect(face.winding).toBe("clockwise");
  expect(face.areaUm2).toBeGreaterThan(0);
  expect(face.boundary).toHaveLength(face.vertices.length);
  expect(new Set(face.vertices.map((vertex) => vertex.nodeId)).size).toBe(face.vertices.length);

  let signedDoubleArea = 0n;
  for (let index = 0; index < face.boundary.length; index += 1) {
    const halfEdge = face.boundary[index]!;
    const wall = topology.walls[halfEdge.wallId];
    expect(wall, `missing canonical wall ${halfEdge.wallId}`).toBeDefined();
    const start = halfEdge.direction === "forward"
      ? getWallStartNode(topology, halfEdge.wallId)
      : getWallEndNode(topology, halfEdge.wallId);
    const end = halfEdge.direction === "forward"
      ? getWallEndNode(topology, halfEdge.wallId)
      : getWallStartNode(topology, halfEdge.wallId);
    const vertex = face.vertices[index]!;
    const nextVertex = face.vertices[(index + 1) % face.vertices.length]!;
    expect(vertex).toEqual({ nodeId: start.id, xUm: start.xUm, yUm: start.yUm });
    expect(nextVertex.nodeId).toBe(end.id);
    signedDoubleArea += BigInt(vertex.xUm) * BigInt(nextVertex.yUm) -
      BigInt(nextVertex.xUm) * BigInt(vertex.yUm);
  }
  expect(signedDoubleArea).toBe(BigInt(face.areaUm2) * 2n);
}

function insert(
  topology: TopologyV2,
  start: readonly [number, number],
  end: readonly [number, number],
  seed: string,
): TopologyV2 {
  return insertWall(topology, {
    start: { xUm: coordinateUm(start[0]), yUm: coordinateUm(start[1]) },
    end: { xUm: coordinateUm(end[0]), yUm: coordinateUm(end[1]) },
    thicknessUm: THICKNESS_UM,
  }, { idSeed: seed }).topology;
}

function fourCellGrid(): TopologyV2 {
  let topology = rectangleTopology();
  topology = insert(topology, [2_000_000, 0], [2_000_000, 3_000_000], "grid-vertical");
  topology = insert(topology, [0, 1_500_000], [4_000_000, 1_500_000], "grid-horizontal");
  return topology;
}

function node(value: string, xUm: number, yUm: number): TopologyNode {
  return { id: nodeId(value), xUm: coordinateUm(xUm), yUm: coordinateUm(yUm) };
}

function wall(value: string, startNodeId: string, endNodeId: string): TopologyWall {
  return { id: wallId(value), startNodeId: nodeId(startNodeId), endNodeId: nodeId(endNodeId), thicknessUm: THICKNESS_UM };
}

function topology(nodes: readonly TopologyNode[], walls: readonly TopologyWall[]): TopologyV2 {
  return {
    status: walls.length ? "active" : "empty",
    modelVersion: 1,
    nodes: Object.fromEntries(nodes.map((value) => [value.id, value])) as Record<NodeId, TopologyNode>,
    walls: Object.fromEntries(walls.map((value) => [value.id, value])) as Record<WallId, TopologyWall>,
  };
}

describe("A2.4 deterministic planar face extraction", () => {
  it("extracts one exact clockwise bounded face and excludes the exterior walk", () => {
    const source = rectangleTopology();
    const result = extractBoundedFaces(source);
    expect(result.faces).toHaveLength(1);
    expect(result.faces[0]!.areaUm2).toBe(12_000_000_000_000);
    expect(result.ignoredBridgeWallIds).toEqual([]);
    expect(result.excludedExteriorWalkCount).toBe(1);
    assertCanonicalFace(source, result.faces[0]!);
  });

  it("extracts adjacent faces with opposite directed uses of their shared wall", () => {
    const source = twoRoomSharedWallTopology();
    const result = extractBoundedFaces(source);
    expect(result.faces).toHaveLength(2);
    expect(result.faces.map((face) => face.areaUm2)).toEqual([12_000_000_000_000, 12_000_000_000_000]);
    const sharedUses = result.faces.flatMap((face) => face.boundary.filter((edge) => edge.wallId === "w-shared"));
    expect(sharedUses).toHaveLength(2);
    expect(new Set(sharedUses.map((edge) => edge.direction))).toEqual(new Set(["forward", "reverse"]));
    for (const face of result.faces) assertCanonicalFace(source, face);
  });

  it("handles an X-junction and four adjacent bounded faces", () => {
    const source = fourCellGrid();
    const result = extractBoundedFaces(source);
    expect(result.faces).toHaveLength(4);
    expect(result.faces.map((face) => face.areaUm2)).toEqual([
      3_000_000_000_000,
      3_000_000_000_000,
      3_000_000_000_000,
      3_000_000_000_000,
    ]);
    expect(result.ignoredBridgeWallIds).toEqual([]);
    for (const face of result.faces) assertCanonicalFace(source, face);
  });

  it("retains a straight degree-2 split node in the exact face boundary", () => {
    const split = splitWallAtPoint(
      rectangleTopology(),
      wallId("w-top"),
      { xUm: coordinateUm(2_000_000), yUm: coordinateUm(0) },
      { idSeed: "degree-2" },
    ).topology;
    const result = extractBoundedFaces(split);
    expect(result.faces).toHaveLength(1);
    expect(result.faces[0]!.vertices).toHaveLength(5);
    expect(result.faces[0]!.areaUm2).toBe(12_000_000_000_000);
    assertCanonicalFace(split, result.faces[0]!);
  });

  it("ignores dangling bridge walls without creating a self-touching pseudo-face", () => {
    const result = insertWall(rectangleTopology(), {
      start: { xUm: coordinateUm(2_000_000), yUm: coordinateUm(0) },
      end: { xUm: coordinateUm(2_000_000), yUm: coordinateUm(1_000_000) },
      thicknessUm: THICKNESS_UM,
    }, { idSeed: "dangling" });
    const faces = extractBoundedFaces(result.topology);
    expect(faces.faces).toHaveLength(1);
    expect(faces.faces[0]!.areaUm2).toBe(12_000_000_000_000);
    expect(faces.ignoredBridgeWallIds).toEqual(result.insertedWallIds);
    expect(faces.faces[0]!.boundary.some((edge) => faces.ignoredBridgeWallIds.includes(edge.wallId))).toBe(false);
    assertCanonicalFace(result.topology, faces.faces[0]!);
  });

  it("returns no faces for an acyclic wall graph and reports every bridge", () => {
    const source = topology(
      [node("n-a", 0, 0), node("n-b", 1_000_000, 0), node("n-c", 1_000_000, 1_000_000)],
      [wall("w-a", "n-a", "n-b"), wall("w-b", "n-b", "n-c")],
    );
    const result = extractBoundedFaces(source);
    expect(result.faces).toEqual([]);
    expect(result.ignoredBridgeWallIds).toEqual([wallId("w-a"), wallId("w-b")]);
    expect(result.excludedExteriorWalkCount).toBe(0);
  });

  it("extracts separate non-overlapping components without conflating exterior boundary walks", () => {
    const source = topology(
      [
        node("n-a1", 0, 0), node("n-a2", 2_000_000, 0), node("n-a3", 2_000_000, 2_000_000), node("n-a4", 0, 2_000_000),
        node("n-b1", 4_000_000, 0), node("n-b2", 7_000_000, 0), node("n-b3", 7_000_000, 2_000_000), node("n-b4", 4_000_000, 2_000_000),
      ],
      [
        wall("w-a1", "n-a1", "n-a2"), wall("w-a2", "n-a2", "n-a3"), wall("w-a3", "n-a3", "n-a4"), wall("w-a4", "n-a4", "n-a1"),
        wall("w-b1", "n-b1", "n-b2"), wall("w-b2", "n-b2", "n-b3"), wall("w-b3", "n-b3", "n-b4"), wall("w-b4", "n-b4", "n-b1"),
      ],
    );
    const result = extractBoundedFaces(source);
    expect(result.faces.map((face) => face.areaUm2)).toEqual([4_000_000_000_000, 6_000_000_000_000]);
    expect(result.excludedExteriorWalkCount).toBe(2);
    for (const face of result.faces) assertCanonicalFace(source, face);
  });

  it("is independent of record insertion order", () => {
    const source = fourCellGrid();
    const reordered: TopologyV2 = {
      ...source,
      nodes: Object.fromEntries(Object.entries(source.nodes).reverse()) as Record<NodeId, TopologyNode>,
      walls: Object.fromEntries(Object.entries(source.walls).reverse()) as Record<WallId, TopologyWall>,
    };
    expect(extractBoundedFaces(reordered)).toEqual(extractBoundedFaces(source));
  });

  it("rejects invalid unsplit crossings through canonical topology validation", () => {
    const invalid = topology(
      [node("n-a", 0, 1_000_000), node("n-b", 2_000_000, 1_000_000), node("n-c", 1_000_000, 0), node("n-d", 1_000_000, 2_000_000)],
      [wall("w-horizontal", "n-a", "n-b"), wall("w-vertical", "n-c", "n-d")],
    );
    expect(() => extractBoundedFaces(invalid)).toThrow(/intersect without canonical splitting/i);
  });

  it("fails explicitly for nested disconnected cycles until hole faces are supported", () => {
    const nested = topology(
      [
        node("n-o1", 0, 0), node("n-o2", 10_000_000, 0), node("n-o3", 10_000_000, 10_000_000), node("n-o4", 0, 10_000_000),
        node("n-i1", 3_000_000, 3_000_000), node("n-i2", 7_000_000, 3_000_000), node("n-i3", 7_000_000, 7_000_000), node("n-i4", 3_000_000, 7_000_000),
      ],
      [
        wall("w-o1", "n-o1", "n-o2"), wall("w-o2", "n-o2", "n-o3"), wall("w-o3", "n-o3", "n-o4"), wall("w-o4", "n-o4", "n-o1"),
        wall("w-i1", "n-i1", "n-i2"), wall("w-i2", "n-i2", "n-i3"), wall("w-i3", "n-i3", "n-i4"), wall("w-i4", "n-i4", "n-i1"),
      ],
    );
    expect(() => extractBoundedFaces(nested)).toThrowError(FaceExtractionError);
    expect(() => extractBoundedFaces(nested)).toThrow(/nested disconnected cycles require explicit hole support/i);
  });
});

describe("A2.4 curated Option-3 faces", () => {
  it("derives 13 bounded faces deterministically from topology alone", () => {
    const source = createOption3TopologyV2();
    const first = extractBoundedFaces(source);
    const second = extractBoundedFaces(createOption3TopologyV2());
    expect(first).toEqual(second);
    expect(first.faces).toHaveLength(13);
    expect(first.ignoredBridgeWallIds).toEqual([]);
    expect(first.excludedExteriorWalkCount).toBe(1);
    expect(first.faces.map(({ id, areaUm2, boundary }) => ({ id, areaUm2, boundaryLength: boundary.length }))).toEqual([
      { id: "f-07944bbfa1fe0b50", areaUm2: 3_298_872_025_000, boundaryLength: 4 },
      { id: "f-25299ab9d0600da6", areaUm2: 3_282_409_675_000, boundaryLength: 4 },
      { id: "f-41bc3b811ac8bc6a", areaUm2: 5_256_571_275_000, boundaryLength: 4 },
      { id: "f-4500a68c39844fc4", areaUm2: 5_230_339_425_000, boundaryLength: 4 },
      { id: "f-46f1f10484862bb1", areaUm2: 19_617_036_140_000, boundaryLength: 5 },
      { id: "f-5bd20450438f7e84", areaUm2: 10_005_182_600_000, boundaryLength: 5 },
      { id: "f-995c81a969eb9c62", areaUm2: 10_950_107_560_000, boundaryLength: 4 },
      { id: "f-9b08821b6b5e1967", areaUm2: 16_793_887_400_000, boundaryLength: 5 },
      { id: "f-b90cdc1e2457fadd", areaUm2: 16_446_188_850_000, boundaryLength: 6 },
      { id: "f-c26ea4cfc8e5967d", areaUm2: 59_030_851_840_000, boundaryLength: 12 },
      { id: "f-c4be109283d52551", areaUm2: 2_496_769_200_000, boundaryLength: 4 },
      { id: "f-ce4b77ad898b046f", areaUm2: 5_274_506_850_000, boundaryLength: 4 },
      { id: "f-dde2d722d470e5e8", areaUm2: 19_617_036_140_000, boundaryLength: 5 },
    ]);
    for (const face of first.faces) assertCanonicalFace(source, face);
  });

  it("keeps faces derived while ProjectV2 spaces remain deferred", () => {
    const project = createOption3ProjectV2();
    expect(project.spaces.status).toBe("deferred");
    expect(extractBoundedFaces(project.topology as TopologyV2)).toEqual(extractBoundedFaces(createOption3TopologyV2()));
  });
});

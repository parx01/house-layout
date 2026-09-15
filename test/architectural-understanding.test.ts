import { describe, expect, it } from "vitest";
import { coordinateUm, lengthUm } from "../src/core/units.js";
import { serializeProject } from "../src/persistence/project-storage.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import { deriveArchitecturalUnderstanding } from "../src/spaces/architectural-understanding.js";
import { extractBoundedFaces } from "../src/spaces/extract-faces.js";
import { spaceId, type SemanticSpacesV1 } from "../src/spaces/semantic-model.js";
import {
  WALL_THICKNESS_9_IN_UM,
  nodeId,
  wallId,
  type NodeId,
  type TopologyNode,
  type TopologyV2,
  type TopologyWall,
  type WallId,
} from "../src/topology/model.js";
import { validateTopologyV2 } from "../src/topology/validation.js";
import { rectangleTopology, twoRoomSharedWallTopology } from "./fixtures/topology.js";

function spacesFor(topology: TopologyV2, ids?: readonly string[]): SemanticSpacesV1 {
  const faces = [...extractBoundedFaces(topology).faces].sort(
    (left, right) => Math.min(...left.vertices.map((point) => point.xUm)) - Math.min(...right.vertices.map((point) => point.xUm)),
  );
  return {
    status: "active",
    modelVersion: 1,
    spaces: faces.map((face, index) => ({
      id: spaceId(ids?.[index] ?? `s-test-${index + 1}`),
      name: ids?.[index] ?? `Test ${index + 1}`,
      category: "other",
      faceId: face.id,
    })),
  };
}

function lShapedTopology(): TopologyV2 {
  const points = [
    ["n-1", 0, 0],
    ["n-2", 4_000_000, 0],
    ["n-3", 4_000_000, 2_000_000],
    ["n-4", 2_000_000, 2_000_000],
    ["n-5", 2_000_000, 4_000_000],
    ["n-6", 0, 4_000_000],
  ] as const;
  const nodes = Object.fromEntries(points.map(([id, x, y]) => {
    const identity = nodeId(id);
    return [identity, { id: identity, xUm: coordinateUm(x), yUm: coordinateUm(y) } satisfies TopologyNode];
  })) as Record<NodeId, TopologyNode>;
  const walls = Object.fromEntries(points.map(([id], index) => {
    const identity = wallId(`w-l-${index + 1}`);
    return [identity, {
      id: identity,
      startNodeId: nodeId(id),
      endNodeId: nodeId(points[(index + 1) % points.length]![0]),
      thicknessUm: WALL_THICKNESS_9_IN_UM,
    } satisfies TopologyWall];
  })) as Record<WallId, TopologyWall>;
  return validateTopologyV2({ status: "active", modelVersion: 1, nodes, walls });
}

describe("A3.4 architectural understanding", () => {
  it("separates centre-line area from exact wall-face clear dimensions", () => {
    const topology = rectangleTopology();
    const result = deriveArchitecturalUnderstanding(topology, spacesFor(topology));
    const room = result.spaces[0]!;
    expect(room.centreLineAreaUm2).toBe(12_000_000_000_000);
    expect(room.clearGeometry).toEqual(expect.objectContaining({
      status: "simpleRectangle",
      widthUm: 3_771_400,
      depthUm: 2_771_400,
      clearAreaUm2: 3_771_400 * 2_771_400,
    }));
    expect(room.clearGeometry.clearAreaUm2).toBeLessThan(room.centreLineAreaUm2);
    expect(room.walls).toHaveLength(4);
    expect(room.walls.every((wall) => wall.thicknessUm === WALL_THICKNESS_9_IN_UM)).toBe(true);
    expect(room.labelAnchor).toEqual({
      xUm: 2_000_000,
      yUm: 1_500_000,
      basis: "largestClearInteriorRectangle",
    });
  });

  it("keeps half-micrometre wall faces and quarter-square-micrometre area exact", () => {
    const topology = structuredClone(rectangleTopology()) as any;
    topology.walls["w-left"].thicknessUm = lengthUm(1);
    topology.walls["w-top"].thicknessUm = lengthUm(1);
    topology.walls["w-right"].thicknessUm = lengthUm(2);
    topology.walls["w-bottom"].thicknessUm = lengthUm(2);
    const validated = validateTopologyV2(topology);
    const clear = deriveArchitecturalUnderstanding(validated, spacesFor(validated)).spaces[0]!.clearGeometry;
    expect(clear).toEqual(expect.objectContaining({
      status: "simpleRectangle",
      widthUm: 3_999_998.5,
      depthUm: 2_999_998.5,
      clearAreaUm2: 3_999_998.5 * 2_999_998.5,
    }));
  });

  it("derives symmetric adjacency through one canonical shared wall", () => {
    const topology = twoRoomSharedWallTopology();
    const result = deriveArchitecturalUnderstanding(topology, spacesFor(topology, ["s-west", "s-east"]));
    expect(result.sharedWalls).toEqual([
      expect.objectContaining({ wallId: "w-shared", spaceIds: ["s-east", "s-west"] }),
    ]);
    expect(result.spaces[0]!.adjacentSpaces).toEqual([{ spaceId: "s-east", wallIds: ["w-shared"] }]);
    expect(result.spaces[1]!.adjacentSpaces).toEqual([{ spaceId: "s-west", wallIds: ["w-shared"] }]);
    expect(Object.keys(topology.walls).filter((identity) => identity === "w-shared")).toHaveLength(1);
    expect(result.spaces.every((space) => !space.boundaryWallIds.includes(wallId("w-shared")))).toBe(true);
  });

  it("treats a wall to an unclaimed face as having no adjacent semantic space", () => {
    const topology = twoRoomSharedWallTopology();
    const allSpaces = spacesFor(topology, ["s-west", "s-east"]);
    const westOnly = { ...allSpaces, spaces: [allSpaces.spaces[0]!] } satisfies SemanticSpacesV1;
    const result = deriveArchitecturalUnderstanding(topology, westOnly);
    expect(result.spaces[0]!.adjacentSpaces).toEqual([]);
    expect(result.spaces[0]!.boundaryWallIds).toContain("w-shared");
    expect(result.unclaimedFaceIds).toHaveLength(1);
  });

  it("returns clear spans instead of inventing width × depth for an L-shaped space", () => {
    const topology = lShapedTopology();
    const clear = deriveArchitecturalUnderstanding(topology, spacesFor(topology)).spaces[0]!.clearGeometry;
    expect(clear.status).toBe("notSimpleRectangle");
    expect("widthUm" in clear).toBe(false);
    expect("depthUm" in clear).toBe(false);
    expect(clear.horizontalSegments.length).toBeGreaterThanOrEqual(2);
    expect(clear.verticalSegments.length).toBeGreaterThanOrEqual(2);
    expect(clear.clearAreaUm2).toBeLessThan(12_000_000_000_000);
  });

  it("reports no clear interior when wall bands consume a tiny synthetic face", () => {
    const topology = structuredClone(rectangleTopology()) as any;
    topology.nodes["n-2"].xUm = coordinateUm(100_000);
    topology.nodes["n-3"].xUm = coordinateUm(100_000);
    topology.nodes["n-3"].yUm = coordinateUm(100_000);
    topology.nodes["n-4"].yUm = coordinateUm(100_000);
    const validated = validateTopologyV2(topology);
    const room = deriveArchitecturalUnderstanding(validated, spacesFor(validated)).spaces[0]!;
    expect(room.clearGeometry).toEqual({
      status: "noClearInterior",
      clearAreaUm2: 0,
      horizontalSegments: [],
      verticalSegments: [],
    });
    expect(room.labelAnchor.basis).toBe("centreLineInteriorFallback");
  });

  it("derives and fixes complete Option-3 understanding without changing persistence", () => {
    const project = createOption3ProjectV2();
    if (project.topology.status !== "active" || project.spaces.status !== "active") throw new Error("Active baseline required.");
    const serializedBefore = serializeProject(project);
    const result = deriveArchitecturalUnderstanding(project.topology, project.spaces);
    const summary = result.spaces.map((space) => ({
      id: space.spaceId,
      centreLineAreaUm2: space.centreLineAreaUm2,
      clearAreaUm2: space.clearGeometry.clearAreaUm2,
      status: space.clearGeometry.status,
      widthUm: space.clearGeometry.status === "simpleRectangle" ? space.clearGeometry.widthUm : null,
      depthUm: space.clearGeometry.status === "simpleRectangle" ? space.clearGeometry.depthUm : null,
      adjacentSpaceIds: space.adjacentSpaces.map((adjacent) => adjacent.spaceId),
      boundaryWallCount: space.boundaryWallIds.length,
      anchor: [space.labelAnchor.xUm, space.labelAnchor.yUm],
    }));
    expect(summary).toEqual([
      { id: "s-bedroom-1", centreLineAreaUm2: 19617036140000, clearAreaUm2: 18124109547500, status: "simpleRectangle", widthUm: 3963850, depthUm: 4572350, adjacentSpaceIds: ["s-dress-1", "s-lobby-dining-puja", "s-toilet-1"], boundaryWallCount: 2, anchor: [3661925, 5566175] },
      { id: "s-toilet-1", centreLineAreaUm2: 5230339425000, clearAreaUm2: 4609124640000, status: "simpleRectangle", widthUm: 1680200, depthUm: 2743200, adjacentSpaceIds: ["s-bedroom-1", "s-dress-1", "s-toilet-2"], boundaryWallCount: 1, anchor: [6598250, 4651600] },
      { id: "s-dress-1", centreLineAreaUm2: 3282409675000, clearAreaUm2: 2881290970000, status: "simpleRectangle", widthUm: 1680200, depthUm: 1714850, adjacentSpaceIds: ["s-bedroom-1", "s-dress-2", "s-lobby-dining-puja", "s-toilet-1"], boundaryWallCount: 0, anchor: [6598250, 6994925] },
      { id: "s-toilet-2", centreLineAreaUm2: 5256571275000, clearAreaUm2: 4633813440000, status: "simpleRectangle", widthUm: 1689200, depthUm: 2743200, adjacentSpaceIds: ["s-bedroom-2", "s-dress-2", "s-toilet-1"], boundaryWallCount: 1, anchor: [8397250, 4651600] },
      { id: "s-dress-2", centreLineAreaUm2: 3298872025000, clearAreaUm2: 2896724620000, status: "simpleRectangle", widthUm: 1689200, depthUm: 1714850, adjacentSpaceIds: ["s-bedroom-2", "s-dress-1", "s-lobby-dining-puja", "s-toilet-2"], boundaryWallCount: 0, anchor: [8397250, 6994925] },
      { id: "s-bedroom-2", centreLineAreaUm2: 19617036140000, clearAreaUm2: 18124109547500, status: "simpleRectangle", widthUm: 3963850, depthUm: 4572350, adjacentSpaceIds: ["s-dress-2", "s-lobby-dining-puja", "s-toilet-2"], boundaryWallCount: 2, anchor: [11338075, 5566175] },
      { id: "s-lobby-dining-puja", centreLineAreaUm2: 59030851840000, clearAreaUm2: 56544132467500, status: "notSimpleRectangle", widthUm: null, depthUm: null, adjacentSpaceIds: ["s-bedroom-1", "s-bedroom-2", "s-dress-1", "s-dress-2", "s-guest-bedroom", "s-kitchen", "s-living-room", "s-staircase", "s-wash-area"], boundaryWallCount: 2, anchor: [9082825, 11018000] },
      { id: "s-kitchen", centreLineAreaUm2: 10950107560000, clearAreaUm2: 10018802590000, status: "simpleRectangle", widthUm: 3051350, depthUm: 3283400, adjacentSpaceIds: ["s-lobby-dining-puja", "s-staircase"], boundaryWallCount: 1, anchor: [3205675, 11246650] },
      { id: "s-staircase", centreLineAreaUm2: 10005182600000, clearAreaUm2: 8949762117500, status: "simpleRectangle", widthUm: 3051350, depthUm: 2933050, adjacentSpaceIds: ["s-kitchen", "s-living-room", "s-lobby-dining-puja"], boundaryWallCount: 2, anchor: [3205675, 14469175] },
      { id: "s-living-room", centreLineAreaUm2: 16446188850000, clearAreaUm2: 15329169240000, status: "simpleRectangle", widthUm: 3352800, depthUm: 4572050, adjacentSpaceIds: ["s-lobby-dining-puja", "s-staircase", "s-toilet-3", "s-wash-area"], boundaryWallCount: 2, anchor: [6522050, 16469675] },
      { id: "s-wash-area", centreLineAreaUm2: 2496769200000, clearAreaUm2: 2148382800000, status: "simpleRectangle", widthUm: 1524000, depthUm: 1409700, adjacentSpaceIds: ["s-guest-bedroom", "s-living-room", "s-lobby-dining-puja", "s-toilet-3"], boundaryWallCount: 0, anchor: [9074750, 14888500] },
      { id: "s-toilet-3", centreLineAreaUm2: 5274506850000, clearAreaUm2: 4645228200000, status: "simpleRectangle", widthUm: 1524000, depthUm: 3048050, adjacentSpaceIds: ["s-guest-bedroom", "s-living-room", "s-wash-area"], boundaryWallCount: 1, anchor: [9074750, 17231675] },
      { id: "s-guest-bedroom", centreLineAreaUm2: 16793887400000, clearAreaUm2: 15403007847500, status: "simpleRectangle", widthUm: 3368950, depthUm: 4572050, adjacentSpaceIds: ["s-lobby-dining-puja", "s-toilet-3", "s-wash-area"], boundaryWallCount: 2, anchor: [11635525, 16469675] },
    ]);
    expect(result.sharedWalls).toHaveLength(25);
    expect(result.unclaimedFaceIds).toEqual([]);
    for (const space of result.spaces) {
      for (const adjacent of space.adjacentSpaces) {
        const reverse = result.spaces.find((candidate) => candidate.spaceId === adjacent.spaceId)!
          .adjacentSpaces.find((candidate) => candidate.spaceId === space.spaceId);
        expect(reverse?.wallIds).toEqual(adjacent.wallIds);
      }
    }
    expect(serializeProject(project)).toBe(serializedBefore);
    expect(serializedBefore).not.toContain("clearAreaUm2");
  });
});

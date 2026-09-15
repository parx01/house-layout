import { describe, expect, it } from "vitest";
import { createOption3TopologyV2, OPTION_3_TOPOLOGY_COORDINATES_UM } from "../src/project/option3-topology.js";
import type { TopologySvgPoint } from "../src/ui/topology-renderer.js";
import { createTopologySvgRenderModel } from "../src/ui/topology-renderer.js";
import {
  WALL_THICKNESS_4_5_IN_UM,
  WALL_THICKNESS_9_IN_UM,
  type NodeId,
  type TopologyNode,
  type TopologyV2,
  type TopologyWall,
  type WallId,
} from "../src/topology/model.js";
import { twoRoomSharedWallTopology } from "./fixtures/topology.js";

function pointInside(point: { x: number; y: number }, polygon: readonly TopologySvgPoint[]): boolean {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const current = polygon[index]!;
    const prior = polygon[previous]!;
    if ((current.y > point.y) === (prior.y > point.y)) continue;
    const intersectionX = prior.x + ((point.y - prior.y) * (current.x - prior.x)) / (current.y - prior.y);
    if (point.x < intersectionX) inside = !inside;
  }
  return inside;
}

describe("A2.6 topology-native SVG render adapter", () => {
  it("derives the complete Option-3 display model from canonical topology", () => {
    const model = createTopologySvgRenderModel(createOption3TopologyV2());
    expect(model.faces).toHaveLength(13);
    expect(model.walls).toHaveLength(41);
    expect(model.junctions).toHaveLength(29);
    expect(model.ignoredBridgeWallIds).toEqual([]);
    expect(model.excludedExteriorWalkCount).toBe(1);
  });

  it("scales exact centre-lines and wall thicknesses into the millimetre SVG viewBox", () => {
    const model = createTopologySvgRenderModel(createOption3TopologyV2());
    expect(new Set(model.walls.map((wall) => wall.thicknessUm))).toEqual(
      new Set([WALL_THICKNESS_4_5_IN_UM, WALL_THICKNESS_9_IN_UM]),
    );
    for (const wall of model.walls) {
      expect(wall.strokeWidth).toBe(wall.thicknessUm / 1_000);
      expect(wall.x1 === wall.x2 || wall.y1 === wall.y2).toBe(true);
      expect(wall.lengthUm).toBeGreaterThan(0);
      expect(wall.lengthLabel).toMatch(/'/);
      expect(wall.thicknessLabel).toMatch(/"/);
    }
    expect(new Set(model.walls.map((wall) => wall.thicknessLabel))).toEqual(new Set(['4.5"', '9"']));
  });

  it("keeps every face tied to directed canonical walls and places its display-only area label inside", () => {
    const model = createTopologySvgRenderModel(createOption3TopologyV2());
    const wallIds = new Set(model.walls.map((wall) => wall.id));
    for (const face of model.faces) {
      expect(face.points).toHaveLength(face.boundary.length);
      expect(face.pointsAttribute.split(" ")).toHaveLength(face.points.length);
      expect(face.areaUm2).toBeGreaterThan(0);
      expect(face.areaLabel).toMatch(/^\d[\d,.]*\.\d sq ft$/);
      expect(pointInside({ x: face.labelX, y: face.labelY }, face.points)).toBe(true);
      for (const edge of face.boundary) expect(wallIds.has(edge.wallId)).toBe(true);
    }
  });

  it("derives junction coordinates and degrees from canonical nodes", () => {
    const model = createTopologySvgRenderModel(createOption3TopologyV2());
    const junction = model.junctions.find((candidate) => candidate.id === "n-option3-front-wet-split-1");
    expect(junction).toMatchObject({
      x: OPTION_3_TOPOLOGY_COORDINATES_UM.x.frontPartitionLeft / 1_000,
      y: OPTION_3_TOPOLOGY_COORDINATES_UM.y.frontWetRoomSplit / 1_000,
      degree: 3,
    });
    expect(junction?.xLabel).toMatch(/'/);
    expect(junction?.yLabel).toMatch(/'/);
  });

  it("represents one shared wall once while both adjacent faces retain directed references", () => {
    const model = createTopologySvgRenderModel(twoRoomSharedWallTopology());
    expect(model.walls.filter((wall) => wall.id === "w-shared")).toHaveLength(1);
    const uses = model.faces.flatMap((face) => face.boundary.filter((edge) => edge.wallId === "w-shared"));
    expect(uses).toHaveLength(2);
    expect(new Set(uses.map((edge) => edge.direction))).toEqual(new Set(["forward", "reverse"]));
  });

  it("is deterministic and independent of topology record insertion order", () => {
    const source = createOption3TopologyV2();
    const reordered: TopologyV2 = {
      ...source,
      nodes: Object.fromEntries(Object.entries(source.nodes).reverse()) as Record<NodeId, TopologyNode>,
      walls: Object.fromEntries(Object.entries(source.walls).reverse()) as Record<WallId, TopologyWall>,
    };
    expect(createTopologySvgRenderModel(reordered)).toEqual(createTopologySvgRenderModel(source));
  });
});

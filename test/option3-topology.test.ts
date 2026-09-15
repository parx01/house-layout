import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OPTION_3_SITE_DEPTH_UM, OPTION_3_SITE_WIDTH_UM } from "../src/core/site.js";
import { coordinateUm } from "../src/core/units.js";
import { parseProjectJson, serializeProject } from "../src/persistence/project-storage.js";
import { createOption3ProjectV2, OPTION_3_V1_RECOVERY_STATE } from "../src/project/option3-baseline.js";
import {
  createOption3TopologyV2,
  OPTION_3_TOPOLOGY_COORDINATES_UM,
} from "../src/project/option3-topology.js";
import {
  getConnectedWallIds,
  getWallEndNode,
  getWallStartNode,
  nodeId,
  WALL_THICKNESS_4_5_IN_UM,
  WALL_THICKNESS_9_IN_UM,
  type TopologyV2,
} from "../src/topology/model.js";
import { findNodeAtCoordinate } from "../src/topology/operations.js";
import { validateTopologyV2 } from "../src/topology/validation.js";

const fixtureText = readFileSync(new URL("../fixtures/option-3-topology-v2.json", import.meta.url), "utf8");
const fixture = JSON.parse(fixtureText) as unknown;

function coordinateKey(xUm: number, yUm: number): string {
  return `${xUm},${yUm}`;
}

function segmentKey(topology: TopologyV2, wallIdValue: string): string {
  const wall = topology.walls[wallIdValue as keyof typeof topology.walls]!;
  const start = topology.nodes[wall.startNodeId]!;
  const end = topology.nodes[wall.endNodeId]!;
  return [coordinateKey(start.xUm, start.yUm), coordinateKey(end.xUm, end.yUm)].sort().join("|");
}

function degree(topology: TopologyV2, xUm: number, yUm: number): number {
  const node = findNodeAtCoordinate(topology, { xUm: coordinateUm(xUm), yUm: coordinateUm(yUm) });
  expect(node).toBeDefined();
  return getConnectedWallIds(topology, node!.id).length;
}

describe("A2.3 curated Option-3 topology", () => {
  it("rebuilds the deterministic fixture through the A2.2 insertion engine", () => {
    const first = createOption3TopologyV2();
    const second = createOption3TopologyV2();
    expect(first).toEqual(fixture);
    expect(second).toEqual(first);
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
    expect(fixtureText).toBe(`${JSON.stringify(first, null, 2)}\n`);
    expect(validateTopologyV2(first, "option3.topology")).toEqual(first);
  });

  it("has the reconciled graph counts and explicit thicknesses", () => {
    const topology = createOption3TopologyV2();
    const degrees = Object.keys(topology.nodes).map((id) => getConnectedWallIds(topology, nodeId(id)).length);
    expect(Object.keys(topology.nodes)).toHaveLength(29);
    expect(Object.keys(topology.walls)).toHaveLength(41);
    expect(degrees.filter((value) => value >= 3)).toHaveLength(23);
    expect(degrees.filter((value) => value === 3)).toHaveLength(22);
    expect(degrees.filter((value) => value === 4)).toHaveLength(1);
    expect(new Set(Object.values(topology.walls).map((wall) => wall.thicknessUm))).toEqual(
      new Set([WALL_THICKNESS_4_5_IN_UM, WALL_THICKNESS_9_IN_UM]),
    );
  });

  it("uses exact orthogonal integer geometry with valid references and no duplicates", () => {
    const topology = createOption3TopologyV2();
    const coordinates = new Set<string>();
    for (const node of Object.values(topology.nodes)) {
      expect(Number.isSafeInteger(node.xUm)).toBe(true);
      expect(Number.isSafeInteger(node.yUm)).toBe(true);
      const key = coordinateKey(node.xUm, node.yUm);
      expect(coordinates.has(key), `coincident node at ${key}`).toBe(false);
      coordinates.add(key);
    }

    const segments = new Set<string>();
    for (const wall of Object.values(topology.walls)) {
      expect(wall.thicknessUm).toBeGreaterThan(0);
      expect(topology.nodes[wall.startNodeId]).toBeDefined();
      expect(topology.nodes[wall.endNodeId]).toBeDefined();
      const start = getWallStartNode(topology, wall.id);
      const end = getWallEndNode(topology, wall.id);
      expect(start.xUm === end.xUm || start.yUm === end.yUm).toBe(true);
      const key = segmentKey(topology, wall.id);
      expect(segments.has(key), `duplicate or reversed wall ${wall.id}`).toBe(false);
      segments.add(key);
    }

    // A2.1 validation also checks every pair for positive-length collinear
    // overlap and every perpendicular crossing for canonical splitting.
    expect(validateTopologyV2(topology)).toEqual(topology);
  });

  it("canonicalises representative T and four-way junctions through shared node identity", () => {
    const topology = createOption3TopologyV2();
    const { x, y } = OPTION_3_TOPOLOGY_COORDINATES_UM;
    expect(degree(topology, x.leftOuter, y.pujaToKitchen)).toBe(3);
    expect(degree(topology, x.centralStep, y.centralToFront)).toBe(3);
    expect(degree(topology, x.frontPartitionLeft, y.frontWetRoomSplit)).toBe(3);
    expect(degree(topology, x.rearPartitionMiddle, y.rearWetRoomSplit)).toBe(4);
  });

  it("stores one physical segment at representative shared-wall locations", () => {
    const topology = createOption3TopologyV2();
    const { x, y } = OPTION_3_TOPOLOGY_COORDINATES_UM;
    const expected = [
      [x.leftOuter, y.pujaToKitchen, x.centralStep, y.pujaToKitchen],
      [x.leftOuter, y.kitchenToStair, x.centralStep, y.kitchenToStair],
      [x.rearPartitionLeft, y.rearWetRoomSplit, x.rearPartitionMiddle, y.rearWetRoomSplit],
      [x.frontPartitionLeft, y.frontWetRoomSplit, x.frontPartitionRight, y.frontWetRoomSplit],
    ] as const;

    const actual = Object.keys(topology.walls).map((id) => segmentKey(topology, id));
    for (const [x1, y1, x2, y2] of expected) {
      const key = [coordinateKey(x1, y1), coordinateKey(x2, y2)].sort().join("|");
      expect(actual.filter((candidate) => candidate === key)).toHaveLength(1);
    }
  });

  it("keeps every centre-line and wall band inside the exact property", () => {
    const topology = createOption3TopologyV2();
    for (const wall of Object.values(topology.walls)) {
      const start = getWallStartNode(topology, wall.id);
      const end = getWallEndNode(topology, wall.id);
      const halfThickness = wall.thicknessUm / 2;
      expect(start.xUm).toBeGreaterThanOrEqual(0);
      expect(start.yUm).toBeGreaterThanOrEqual(0);
      expect(end.xUm).toBeLessThanOrEqual(OPTION_3_SITE_WIDTH_UM);
      expect(end.yUm).toBeLessThanOrEqual(OPTION_3_SITE_DEPTH_UM);
      if (start.yUm === end.yUm) {
        expect(start.yUm - halfThickness).toBeGreaterThanOrEqual(0);
        expect(start.yUm + halfThickness).toBeLessThanOrEqual(OPTION_3_SITE_DEPTH_UM);
      } else {
        expect(start.xUm - halfThickness).toBeGreaterThanOrEqual(0);
        expect(start.xUm + halfThickness).toBeLessThanOrEqual(OPTION_3_SITE_WIDTH_UM);
      }
    }
  });

  it("is active and exact after ProjectV2 save/load", () => {
    const project = createOption3ProjectV2();
    expect(project.topology.status).toBe("active");
    const recovered = parseProjectJson(serializeProject(project));
    expect(recovered.topology).toEqual(createOption3TopologyV2());
    expect(recovered.topology.status).toBe("active");
    expect(recovered.legacyEditorState).toEqual(OPTION_3_V1_RECOVERY_STATE);
  });

  it("keeps V1 recovery while activating the curated topology", () => {
    const recovered = parseProjectJson(JSON.stringify({ version: 1, ...OPTION_3_V1_RECOVERY_STATE }));
    expect(recovered.topology).toEqual(createOption3TopologyV2());
    expect(recovered.legacyEditorState).toEqual(OPTION_3_V1_RECOVERY_STATE);
  });
});

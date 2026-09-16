import { describe, expect, it } from "vitest";
import { coordinateUm, lengthUm } from "../src/core/units.js";
import {
  clearCanonicalSelection,
  clearHoveredEntity,
  createCanonicalHitTestModel,
  createCanonicalSelectionState,
  hitTestCanonicalSelection,
  reconcileCanonicalSelection,
  resolveCanonicalSelection,
  selectCanonicalEntity,
  setHoveredEntity,
} from "../src/interaction/selection.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import type { ProjectV2 } from "../src/project/schema.js";
import { applyTopologyChangeResult, applyTopologyMoveTransaction } from "../src/project/topology-update.js";
import { validateProjectV2 } from "../src/project/validation.js";
import { deriveArchitecturalUnderstanding } from "../src/spaces/architectural-understanding.js";
import { extractBoundedFaces } from "../src/spaces/extract-faces.js";
import { spaceId, type SemanticSpacesV2 } from "../src/spaces/semantic-model.js";
import { nodeId, wallId, type NodeId, type TopologyNode, type TopologyV2, type TopologyWall, type WallId } from "../src/topology/model.js";
import { moveWallPerpendicular } from "../src/topology/movement.js";
import { splitWallAtPoint } from "../src/topology/operations.js";
import { rectangleTopology, twoRoomSharedWallTopology } from "./fixtures/topology.js";

const VIEWPORT = { xUmPerCssPixel: 100_000, yUmPerCssPixel: 100_000 };

function spacesFor(topology: TopologyV2): SemanticSpacesV2 {
  return {
    status: "active",
    modelVersion: 2,
    spaces: extractBoundedFaces(topology).faces.map((face, index) => ({
      id: spaceId(`s-room-${index + 1}`),
      name: `Room ${index + 1}`,
      category: "room",
      architecturalRole: "ordinaryRoom",
      enclosure: "enclosedCovered",
      faceId: face.id,
    })),
  };
}

function insetProject(topology: TopologyV2): ProjectV2 {
  const baseline = createOption3ProjectV2();
  const inset: TopologyV2 = {
    ...structuredClone(topology),
    nodes: Object.fromEntries(Object.entries(topology.nodes).map(([identity, node]) => [identity, {
      ...node,
      xUm: coordinateUm(node.xUm + 1_000_000),
      yUm: coordinateUm(node.yUm + 1_000_000),
    }])) as Record<NodeId, TopologyNode>,
  };
  return validateProjectV2({
    ...structuredClone(baseline),
    topology: inset,
    spaces: { status: "deferred", targetStage: "A2", modelVersion: null, data: null },
  });
}

describe("B1 canonical hit testing", () => {
  it("hits a thin wall within the 10 px minimum and misses outside it", () => {
    const topology = structuredClone(rectangleTopology()) as TopologyV2;
    topology.walls[wallId("w-top")] = {
      ...topology.walls[wallId("w-top")]!,
      thicknessUm: lengthUm(1),
    };
    const model = createCanonicalHitTestModel(topology, spacesFor(topology));
    expect(hitTestCanonicalSelection(model, { xUm: 2_000_000, yUm: -999_999 }, VIEWPORT)?.entity)
      .toEqual({ type: "wall", id: "w-top" });
    expect(hitTestCanonicalSelection(model, { xUm: 2_000_000, yUm: -1_000_001 }, VIEWPORT)).toBeNull();
  });

  it("uses physical wall thickness when it exceeds the minimum screen tolerance", () => {
    const topology = rectangleTopology();
    const model = createCanonicalHitTestModel(topology);
    const closeScale = { xUmPerCssPixel: 10_000, yUmPerCssPixel: 10_000 };
    expect(hitTestCanonicalSelection(model, { xUm: 2_000_000, yUm: -110_000 }, closeScale)?.entity.type)
      .toBe("wall");
    expect(hitTestCanonicalSelection(model, { xUm: 2_000_000, yUm: -120_000 }, closeScale)).toBeNull();
  });

  it("applies node-over-wall and wall-over-space precedence", () => {
    const topology = rectangleTopology();
    const model = createCanonicalHitTestModel(topology, spacesFor(topology));
    expect(hitTestCanonicalSelection(model, { xUm: 0, yUm: 0 }, VIEWPORT)?.entity)
      .toEqual({ type: "node", id: "n-1" });
    expect(hitTestCanonicalSelection(model, { xUm: 2_000_000, yUm: 500_000 }, VIEWPORT)?.entity)
      .toEqual({ type: "wall", id: "w-top" });
    expect(hitTestCanonicalSelection(model, { xUm: 2_000_000, yUm: 1_500_000 }, VIEWPORT)?.entity)
      .toEqual({ type: "space", id: "s-room-1" });
  });

  it("keeps screen-space tolerance stable when zoom conversion changes", () => {
    const model = createCanonicalHitTestModel(rectangleTopology());
    const atWideScale = hitTestCanonicalSelection(
      model,
      { xUm: 2_000_000, yUm: -900_000 },
      { xUmPerCssPixel: 100_000, yUmPerCssPixel: 100_000 },
    );
    const atCloseScale = hitTestCanonicalSelection(
      model,
      { xUm: 2_000_000, yUm: -90_000 },
      { xUmPerCssPixel: 10_000, yUmPerCssPixel: 10_000 },
    );
    expect(atWideScale?.entity).toEqual({ type: "wall", id: "w-top" });
    expect(atCloseScale?.entity).toEqual(atWideScale?.entity);
  });

  it("is deterministic after node, wall, and semantic-space record reordering", () => {
    const topology = twoRoomSharedWallTopology();
    const spaces = spacesFor(topology);
    const reordered: TopologyV2 = {
      ...topology,
      nodes: Object.fromEntries(Object.entries(topology.nodes).reverse()) as Record<NodeId, TopologyNode>,
      walls: Object.fromEntries(Object.entries(topology.walls).reverse()) as Record<WallId, TopologyWall>,
    };
    const reversedSpaces: SemanticSpacesV2 = { ...spaces, spaces: [...spaces.spaces].reverse() };
    const point = { xUm: 3_000_000, yUm: 2_000_000 };
    expect(hitTestCanonicalSelection(createCanonicalHitTestModel(reordered, reversedSpaces), point, VIEWPORT))
      .toEqual(hitTestCanonicalSelection(createCanonicalHitTestModel(topology, spaces), point, VIEWPORT));
  });
});

describe("B1 selection state and reconciliation", () => {
  it("maintains independent immutable hover and selection transitions", () => {
    const empty = createCanonicalSelectionState();
    const hovered = setHoveredEntity(empty, { type: "node", id: nodeId("n-1") });
    const selected = selectCanonicalEntity(hovered, { type: "wall", id: wallId("w-top") });
    expect(selected).toEqual({
      hovered: { type: "node", id: "n-1" },
      selected: { type: "wall", id: "w-top" },
    });
    expect(Object.isFrozen(selected)).toBe(true);
    expect(clearHoveredEntity(selected).selected).toEqual(selected.selected);
    expect(clearCanonicalSelection(selected).hovered).toEqual(selected.hovered);
    expect(selectCanonicalEntity(selected, { type: "node", id: nodeId("n-2") }).selected)
      .toEqual({ type: "node", id: "n-2" });
  });

  it("preserves canonical wall and SpaceId selection through harmless Option-3 regeneration", () => {
    const before = createOption3ProjectV2();
    if (before.topology.status !== "active") throw new Error("Active topology required.");
    const movement = moveWallPerpendicular(
      before.topology,
      wallId("w-option3-front-wet-split-1"),
      100_000,
    );
    const after = applyTopologyMoveTransaction(before, movement).project;
    const state = {
      hovered: { type: "space" as const, id: spaceId("s-kitchen") },
      selected: { type: "wall" as const, id: wallId("w-option3-front-wet-split-1") },
    };
    expect(reconcileCanonicalSelection(state, after)).toEqual(state);
  });

  it("preserves SpaceId when an unambiguous wall split changes its FaceId", () => {
    const before = createOption3ProjectV2();
    if (before.topology.status !== "active" || before.spaces.status !== "active") {
      throw new Error("Active baseline required.");
    }
    const selectedSpace = before.spaces.spaces[0]!;
    const face = extractBoundedFaces(before.topology).faces.find((candidate) => candidate.id === selectedSpace.faceId)!;
    const targetWallId = face.boundary[0]!.wallId;
    const wall = before.topology.walls[targetWallId]!;
    const start = before.topology.nodes[wall.startNodeId]!;
    const end = before.topology.nodes[wall.endNodeId]!;
    const change = splitWallAtPoint(before.topology, targetWallId, {
      xUm: coordinateUm((start.xUm + end.xUm) / 2),
      yUm: coordinateUm((start.yUm + end.yUm) / 2),
    }, { idSeed: "b1-space-rebind" });
    const update = applyTopologyChangeResult(before, change);
    expect(update.status).toBe("committed");
    if (update.status !== "committed" || update.project.spaces.status !== "active") {
      throw new Error("Committed semantic project required.");
    }
    const nextSpace = update.project.spaces.spaces.find((space) => space.id === selectedSpace.id)!;
    expect(nextSpace.faceId).not.toBe(selectedSpace.faceId);
    const state = selectCanonicalEntity(createCanonicalSelectionState(), {
      type: "space",
      id: selectedSpace.id,
    });
    expect(reconcileCanonicalSelection(state, update.project).selected).toEqual({
      type: "space",
      id: selectedSpace.id,
    });
  });

  it("clears removed entities unless an explicit one-to-one canonical remap exists", () => {
    const before = insetProject(rectangleTopology());
    if (before.topology.status !== "active") throw new Error("Active topology required.");
    const oldWallId = wallId("w-top");
    const oldWall = before.topology.walls[oldWallId]!;
    const start = before.topology.nodes[oldWall.startNodeId]!;
    const end = before.topology.nodes[oldWall.endNodeId]!;
    const change = splitWallAtPoint(before.topology, oldWallId, {
      xUm: coordinateUm((start.xUm + end.xUm) / 2),
      yUm: coordinateUm((start.yUm + end.yUm) / 2),
    }, { idSeed: "b1-wall-replacement" });
    const update = applyTopologyChangeResult(before, change);
    expect(update.status).toBe("committed");
    if (update.status !== "committed") throw new Error("Committed topology required.");
    const state = selectCanonicalEntity(createCanonicalSelectionState(), { type: "wall", id: oldWallId });
    expect(reconcileCanonicalSelection(state, update.project).selected).toBeNull();
    const explicitReplacement = change.wallReplacements[oldWallId]![0]!;
    expect(reconcileCanonicalSelection(state, update.project, {
      walls: { [oldWallId]: explicitReplacement },
    }).selected).toEqual({ type: "wall", id: explicitReplacement });
    expect(() => reconcileCanonicalSelection(state, update.project, {
      walls: { first: explicitReplacement, second: explicitReplacement },
    })).toThrow(/one-to-one/);
  });

  it("does not mutate ProjectV2 while reconciling or resolving", () => {
    const project = createOption3ProjectV2();
    const snapshot = structuredClone(project);
    const state = selectCanonicalEntity(createCanonicalSelectionState(), {
      type: "space",
      id: spaceId("s-kitchen"),
    });
    reconcileCanonicalSelection(state, project);
    resolveCanonicalSelection(project, state.selected);
    expect(project).toEqual(snapshot);
  });
});

describe("B1 Option-3 canonical selection regressions", () => {
  it("returns the exact representative exterior wall, internal wall, node, and kitchen IDs", () => {
    const project = createOption3ProjectV2();
    if (project.topology.status !== "active" || project.spaces.status !== "active") {
      throw new Error("Active Option-3 project required.");
    }
    const model = createCanonicalHitTestModel(project.topology, project.spaces);
    const scale = { xUmPerCssPixel: 20_000, yUmPerCssPixel: 20_000 };
    for (const identity of [wallId("w-option3-left-outer-1"), wallId("w-option3-front-wet-split-1")]) {
      const wall = project.topology.walls[identity]!;
      const start = project.topology.nodes[wall.startNodeId]!;
      const end = project.topology.nodes[wall.endNodeId]!;
      expect(hitTestCanonicalSelection(model, {
        xUm: (start.xUm + end.xUm) / 2,
        yUm: (start.yUm + end.yUm) / 2,
      }, scale)?.entity).toEqual({ type: "wall", id: identity });
    }
    const junction = project.topology.nodes[nodeId("n-option3-front-wet-split-1")]!;
    expect(hitTestCanonicalSelection(model, junction, scale)?.entity)
      .toEqual({ type: "node", id: "n-option3-front-wet-split-1" });
    const understanding = deriveArchitecturalUnderstanding(project.topology, project.spaces);
    const kitchen = understanding.spaces.find((space) => space.spaceId === "s-kitchen")!;
    expect(hitTestCanonicalSelection(model, kitchen.labelAnchor, scale)?.entity)
      .toEqual({ type: "space", id: "s-kitchen" });
  });

  it("resolves inspector-ready semantic, classification, and junction data", () => {
    const project = createOption3ProjectV2();
    expect(resolveCanonicalSelection(project, { type: "space", id: spaceId("s-kitchen") }))
      .toMatchObject({
        type: "space",
        id: "s-kitchen",
        name: "Kitchen",
        category: "service",
        architecturalRole: "service",
        enclosure: "enclosedCovered",
      });
    expect(resolveCanonicalSelection(project, {
      type: "wall",
      id: wallId("w-option3-left-outer-1"),
    })).toMatchObject({ type: "wall", classification: "exterior", orientation: "vertical" });
    expect(resolveCanonicalSelection(project, {
      type: "wall",
      id: wallId("w-option3-front-wet-split-1"),
    })).toMatchObject({ type: "wall", classification: "internalShared", orientation: "vertical" });
    expect(resolveCanonicalSelection(project, {
      type: "node",
      id: nodeId("n-option3-front-wet-split-1"),
    })).toMatchObject({ type: "node", degree: 3 });
  });
});

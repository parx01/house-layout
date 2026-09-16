import { describe, expect, it } from "vitest";
import {
  derivePhysicalExteriorEnvelope,
  physicalExteriorEnvelopeGeometryEquals,
} from "../src/building/physical-exterior-envelope.js";
import { coordinateUm, lengthUm } from "../src/core/units.js";
import { createOption3TopologyV2 } from "../src/project/option3-topology.js";
import { nodeId, wallId, type TopologyV2 } from "../src/topology/model.js";
import { moveJunction, moveWallPerpendicular } from "../src/topology/movement.js";
import { insertWall, splitWallAtPoint } from "../src/topology/operations.js";
import { validateTopologyV2 } from "../src/topology/validation.js";
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
    }, { idSeed: `physical-detached-${index + 1}` }).topology;
  }
  return current;
}

describe("A4-Core.2 physical exterior envelope", () => {
  it("offsets a uniform rectangle to exact outer wall faces with resolved corners", () => {
    const result = derivePhysicalExteriorEnvelope(rectangleTopology());
    expect(result.loops).toHaveLength(1);
    expect(result.loops[0]!.vertices).toEqual([
      { xUm: -114_300, yUm: -114_300 },
      { xUm: 4_114_300, yUm: -114_300 },
      { xUm: 4_114_300, yUm: 3_114_300 },
      { xUm: -114_300, yUm: 3_114_300 },
    ]);
    expect(result.loops[0]!.wallFaces).toHaveLength(4);
  });

  it("uses each wall thickness and intersects unequal outer faces at a continuous corner", () => {
    const candidate = structuredClone(rectangleTopology()) as any;
    candidate.walls["w-top"].thicknessUm = lengthUm(200_000);
    candidate.walls["w-right"].thicknessUm = lengthUm(400_000);
    const topology = validateTopologyV2(candidate);
    const loop = derivePhysicalExteriorEnvelope(topology).loops[0]!;
    expect(loop.vertices).toContainEqual({ xUm: 4_200_000, yUm: -100_000 });
    const topFace = loop.wallFaces.find((face) => face.wallId === "w-top")!;
    const rightFace = loop.wallFaces.find((face) => face.wallId === "w-right")!;
    expect(topFace.end).toEqual({ xUm: 4_200_000, yUm: -100_000 });
    expect(rightFace.start).toEqual(topFace.end);
  });

  it("adds one exact connector where collinear exterior wall thickness changes", () => {
    const split = splitWallAtPoint(
      rectangleTopology(),
      wallId("w-top"),
      { xUm: coordinateUm(2_000_000), yUm: coordinateUm(0) },
      { idSeed: "physical-thickness-step" },
    );
    const candidate = structuredClone(split.topology) as any;
    const replacementIds = split.wallReplacements[wallId("w-top")]!;
    const [firstReplacementId, secondReplacementId] = replacementIds;
    if (!firstReplacementId || !secondReplacementId) throw new Error("Two wall replacements required.");
    candidate.walls[firstReplacementId].thicknessUm = lengthUm(200_000);
    candidate.walls[secondReplacementId].thicknessUm = lengthUm(400_000);
    const loop = derivePhysicalExteriorEnvelope(validateTopologyV2(candidate)).loops[0]!;
    const stepPoints = loop.vertices
      .filter((point) => point.xUm === 2_000_000)
      .sort((left, right) => left.yUm - right.yUm);
    expect(stepPoints).toEqual([
      { xUm: 2_000_000, yUm: -200_000 },
      { xUm: 2_000_000, yUm: -100_000 },
    ]);
  });

  it("keeps disconnected enclosures as deterministic independent physical loops", () => {
    const topology = addDetachedRectangle(rectangleTopology());
    const first = derivePhysicalExteriorEnvelope(topology);
    const second = derivePhysicalExteriorEnvelope(structuredClone(topology));
    expect(first.loops).toHaveLength(2);
    expect(first).toEqual(second);
    expect(first.loops[0]!.geometryKey).not.toBe(first.loops[1]!.geometryKey);
  });

  it("ignores internal shared-wall movement when comparing physical footprint geometry", () => {
    const before = twoRoomSharedWallTopology();
    const after = moveWallPerpendicular(before, wallId("w-shared"), 250_000).topology;
    const beforeEnvelope = derivePhysicalExteriorEnvelope(before);
    const afterEnvelope = derivePhysicalExteriorEnvelope(after);
    expect(physicalExteriorEnvelopeGeometryEquals(beforeEnvelope, afterEnvelope)).toBe(true);
    expect(afterEnvelope.loops[0]!.vertices).toEqual(beforeEnvelope.loops[0]!.vertices);
  });

  it("changes physical footprint geometry after a valid exterior wall movement", () => {
    const before = rectangleTopology();
    const after = moveWallPerpendicular(before, wallId("w-left"), 250_000).topology;
    const beforeEnvelope = derivePhysicalExteriorEnvelope(before);
    const afterEnvelope = derivePhysicalExteriorEnvelope(after);
    expect(physicalExteriorEnvelopeGeometryEquals(beforeEnvelope, afterEnvelope)).toBe(false);
    expect(afterEnvelope.loops[0]!.vertices[0]!.xUm).toBe(beforeEnvelope.loops[0]!.vertices[0]!.xUm + 250_000);
  });

  it("does not mistake an internal-junction subdivision change for an envelope change", () => {
    const before = twoRoomSharedWallTopology();
    const after = moveJunction(before, nodeId("n-2"), {
      xUm: coordinateUm(3_250_000),
      yUm: coordinateUm(0),
    }).topology;
    const beforeEnvelope = derivePhysicalExteriorEnvelope(before);
    const afterEnvelope = derivePhysicalExteriorEnvelope(after);
    expect(physicalExteriorEnvelopeGeometryEquals(beforeEnvelope, afterEnvelope)).toBe(true);
    expect(afterEnvelope.loops[0]!.vertices).toEqual(beforeEnvelope.loops[0]!.vertices);
  });

  it("derives one continuous deterministic physical envelope for Option-3", () => {
    const topology = createOption3TopologyV2();
    const result = derivePhysicalExteriorEnvelope(topology);
    expect(result.loops).toHaveLength(1);
    expect(result.loops[0]!.sourceBoundary).toHaveLength(16);
    expect(result.loops[0]!.wallFaces).toHaveLength(16);
    expect(result.loops[0]!.vertices).toEqual([
      { xUm: 1_451_400, yUm: 3_051_400 },
      { xUm: 13_548_600, yUm: 3_051_400 },
      { xUm: 13_548_600, yUm: 18_984_300 },
      { xUm: 4_731_350, yUm: 18_984_300 },
      { xUm: 4_731_350, yUm: 16_164_300 },
      { xUm: 1_451_400, yUm: 16_164_300 },
    ]);
    expect(derivePhysicalExteriorEnvelope(createOption3TopologyV2())).toEqual(result);
  });

  it("keeps Option-3 envelope stable for an internal move and changes it for an exterior move", () => {
    const topology = createOption3TopologyV2();
    const internalMove = moveWallPerpendicular(
      topology,
      wallId("w-option3-front-wet-split-1"),
      100_000,
    ).topology;
    const exteriorMove = moveWallPerpendicular(
      topology,
      wallId("w-option3-left-outer-1"),
      100_000,
    ).topology;
    const baseline = derivePhysicalExteriorEnvelope(topology);
    expect(physicalExteriorEnvelopeGeometryEquals(
      baseline,
      derivePhysicalExteriorEnvelope(internalMove),
    )).toBe(true);
    expect(physicalExteriorEnvelopeGeometryEquals(
      baseline,
      derivePhysicalExteriorEnvelope(exteriorMove),
    )).toBe(false);
  });
});

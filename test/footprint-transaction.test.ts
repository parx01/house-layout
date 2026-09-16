import { describe, expect, it } from "vitest";
import { evaluateFootprintMoveTransaction } from "../src/building/footprint-transaction.js";
import { coordinateUm } from "../src/core/units.js";
import { createOption3TopologyV2 } from "../src/project/option3-topology.js";
import { fourWayJunctionTopology, rectangleTopology, twoRoomSharedWallTopology } from "./fixtures/topology.js";
import { nodeId, wallId } from "../src/topology/model.js";
import { moveJunction, moveWallPerpendicular } from "../src/topology/movement.js";

describe("A4-Core.3 footprint movement transaction contract", () => {
  it("reports an internal shared-wall move without a footprint change", () => {
    const before = twoRoomSharedWallTopology();
    const result = evaluateFootprintMoveTransaction(before, (topology) =>
      moveWallPerpendicular(topology, wallId("w-shared"), 250_000));
    expect(result.status).toBe("committed");
    if (result.status !== "committed") throw new Error("Committed transaction required.");
    expect(result.affectedNodeIds).toEqual(["n-2", "n-5"]);
    expect(result.affectedWallIds).toContain("w-shared");
    expect(result.involvedWallClassifications.internalSharedWallIds).toEqual(["w-shared"]);
    expect(result.footprintChanged).toBe(false);
    expect(result.afterEnvelope.geometryKey).toBe(result.beforeEnvelope.geometryKey);
  });

  it("reports an exterior wall move from actual envelope geometry", () => {
    const before = rectangleTopology();
    const result = evaluateFootprintMoveTransaction(before, (topology) =>
      moveWallPerpendicular(topology, wallId("w-left"), 250_000));
    expect(result.status).toBe("committed");
    if (result.status !== "committed") throw new Error("Committed transaction required.");
    expect(result.involvedWallClassifications.exteriorWallIds).toContain("w-left");
    expect(result.involvedWallClassifications.internalSharedWallIds).toEqual([]);
    expect(result.footprintChanged).toBe(true);
    expect(result.afterEnvelope.geometryKey).not.toBe(result.beforeEnvelope.geometryKey);
  });

  it("uses geometry for a junction touching exterior and internal walls", () => {
    const before = twoRoomSharedWallTopology();
    const internalOnly = evaluateFootprintMoveTransaction(before, (topology) =>
      moveJunction(topology, nodeId("n-2"), {
        xUm: coordinateUm(3_250_000),
        yUm: coordinateUm(0),
      }));
    expect(internalOnly.status).toBe("committed");
    if (internalOnly.status !== "committed") throw new Error("Committed transaction required.");
    expect(internalOnly.involvedWallClassifications.exteriorWallIds).toEqual([
      "w-bottom-left", "w-bottom-right", "w-top-left", "w-top-right",
    ]);
    expect(internalOnly.involvedWallClassifications.internalSharedWallIds).toEqual(["w-shared"]);
    expect(internalOnly.footprintChanged).toBe(false);

    const exteriorShift = evaluateFootprintMoveTransaction(before, (topology) =>
      moveJunction(topology, nodeId("n-2"), {
        xUm: coordinateUm(3_250_000),
        yUm: coordinateUm(250_000),
      }));
    expect(exteriorShift.status).toBe("committed");
    if (exteriorShift.status !== "committed") throw new Error("Committed transaction required.");
    expect(exteriorShift.involvedWallClassifications.exteriorWallIds).toEqual([
      "w-bottom-left", "w-bottom-right", "w-left", "w-right", "w-top-left", "w-top-right",
    ]);
    expect(exteriorShift.involvedWallClassifications.internalSharedWallIds).toEqual(["w-shared"]);
    expect(exteriorShift.footprintChanged).toBe(true);
  });

  it("reports non-face-boundary walls without inventing a footprint", () => {
    const before = fourWayJunctionTopology();
    const result = evaluateFootprintMoveTransaction(before, (topology) =>
      moveWallPerpendicular(topology, wallId("w-east"), 100_000));
    expect(result.status).toBe("committed");
    if (result.status !== "committed") throw new Error("Committed transaction required.");
    expect(result.beforeEnvelope.loops).toEqual([]);
    expect(result.afterEnvelope.loops).toEqual([]);
    expect(result.involvedWallClassifications.nonFaceBoundaryWallIds).toEqual([
      "w-east", "w-north", "w-south", "w-west",
    ]);
    expect(result.footprintChanged).toBe(false);
  });

  it("atomically rejects an invalid A2.5 move without exposing committed topology", () => {
    const before = rectangleTopology();
    const snapshot = structuredClone(before);
    const result = evaluateFootprintMoveTransaction(before, (topology) =>
      moveWallPerpendicular(topology, wallId("w-left"), 4_000_000));
    expect(result.status).toBe("rejected");
    if (result.status !== "rejected") throw new Error("Rejected transaction required.");
    expect(result.affectedNodeIds).toEqual([]);
    expect(result.affectedWallIds).toEqual([]);
    expect(result.involvedWallClassifications).toEqual({
      exteriorWallIds: [],
      internalSharedWallIds: [],
      nonFaceBoundaryWallIds: [],
    });
    expect(result.afterEnvelope.geometryKey).toBe(result.beforeEnvelope.geometryKey);
    expect(result.footprintChanged).toBe(false);
    expect("committedTopology" in result).toBe(false);
    expect(before).toEqual(snapshot);
  });

  it("reports the representative internal Option-3 move as footprint-preserving", () => {
    const before = createOption3TopologyV2();
    const result = evaluateFootprintMoveTransaction(before, (topology) =>
      moveWallPerpendicular(topology, wallId("w-option3-front-wet-split-1"), 100_000));
    expect(result.status).toBe("committed");
    if (result.status !== "committed") throw new Error("Committed transaction required.");
    expect(result.involvedWallClassifications.internalSharedWallIds).toContain(
      "w-option3-front-wet-split-1",
    );
    expect(result.footprintChanged).toBe(false);
  });

  it("reports the representative exterior Option-3 move as footprint-changing", () => {
    const before = createOption3TopologyV2();
    const result = evaluateFootprintMoveTransaction(before, (topology) =>
      moveWallPerpendicular(topology, wallId("w-option3-left-outer-1"), 100_000));
    expect(result.status).toBe("committed");
    if (result.status !== "committed") throw new Error("Committed transaction required.");
    expect(result.involvedWallClassifications.exteriorWallIds).toContain("w-option3-left-outer-1");
    expect(result.footprintChanged).toBe(true);
  });
});

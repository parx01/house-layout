import { describe, expect, it } from "vitest";
import {
  CanonicalDragController,
  canCommitCanonicalDrag,
  clientPointToModelUm,
  exceedsDragActivationThreshold,
} from "../src/interaction/canonical-drag.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import { nodeId, wallId } from "../src/topology/model.js";

describe("B2 canonical drag controller", () => {
  it("converts client coordinates deterministically through a zoomed inverse SVG transform", () => {
    expect(clientPointToModelUm(
      { x: 125.25, y: 80.5 },
      { a: 0.5, b: 0, c: 0, d: 0.25, e: -10, f: 5 },
    )).toEqual({ xUm: 52_625, yUm: 25_125 });
    expect(clientPointToModelUm(
      { x: 125.25, y: 80.5 },
      { a: 0.5, b: 0, c: 0, d: 0.25, e: -10, f: 5 },
    )).toEqual({ xUm: 52_625, yUm: 25_125 });
  });

  it("uses a three CSS-pixel drag activation threshold", () => {
    expect(exceedsDragActivationThreshold({ x: 10, y: 10 }, { x: 12, y: 12 })).toBe(false);
    expect(exceedsDragActivationThreshold({ x: 10, y: 10 }, { x: 13, y: 10 })).toBe(true);
  });

  it("moves a horizontal wall only by the perpendicular pointer displacement", () => {
    const project = createOption3ProjectV2();
    const id = wallId("w-option3-puja-kitchen-3");
    const controller = CanonicalDragController.begin(project, { type: "wall", id }, { xUm: 1_000, yUm: 2_000 });
    const preview = controller.preview({ xUm: 901_000, yUm: 102_000 });
    expect(preview.preview.status).toBe("valid");
    if (preview.preview.status !== "valid") throw new Error("valid preview required");
    expect(preview.preview.metadata.movement).toMatchObject({
      kind: "wallPerpendicular",
      wallId: id,
      offsetUm: 100_000,
    });
    expect(preview.preview.metadata.footprintChanged).toBe(false);
    expect(preview.preview.metadata.semanticReconciliation.preservedBindings).toHaveLength(13);
    expect(controller.snapshot().committedProject).toEqual(project);
  });

  it("moves a vertical exterior wall only by the perpendicular pointer displacement", () => {
    const project = createOption3ProjectV2();
    const id = wallId("w-option3-left-outer-1");
    const controller = CanonicalDragController.begin(project, { type: "wall", id }, { xUm: 0, yUm: 0 });
    const preview = controller.preview({ xUm: 100_000, yUm: 900_000 });
    expect(preview.preview.status).toBe("valid");
    if (preview.preview.status !== "valid") throw new Error("valid preview required");
    expect(preview.preview.metadata.movement).toMatchObject({ offsetUm: 100_000 });
    expect(preview.preview.metadata.footprintChanged).toBe(true);
    expect(preview.preview.metadata.involvedWallClassifications.exteriorWallIds).toContain(id);
  });

  it("does not turn parallel-only wall pointer movement into an undoable change", () => {
    const project = createOption3ProjectV2();
    const controller = CanonicalDragController.begin(
      project,
      { type: "wall", id: wallId("w-option3-front-wet-split-1") },
      { xUm: 0, yUm: 0 },
    );
    const preview = controller.preview({ xUm: 0, yUm: 500_000 });
    expect(preview.preview.status).toBe("valid");
    if (preview.preview.status !== "valid") throw new Error("valid preview required");
    expect(preview.preview.metadata.movement.nodeChanges).toHaveLength(0);
    const finished = controller.commit();
    expect(finished.status).toBe("cancelled");
    if (finished.status !== "cancelled") throw new Error("cancelled result required");
    expect(finished.reason).toBe("noValidPreview");
    expect(finished.result.undoableChange).toBeNull();
  });

  it("preserves a junction grab offset and lets A2.5 propagate connected walls", () => {
    const project = createOption3ProjectV2();
    if (project.topology.status !== "active") throw new Error("active topology required");
    const id = nodeId("n-option3-front-wet-split-1");
    const node = project.topology.nodes[id]!;
    const controller = CanonicalDragController.begin(
      project,
      { type: "node", id },
      { xUm: node.xUm + 23_000, yUm: node.yUm - 17_000 },
    );
    const preview = controller.preview({ xUm: node.xUm + 73_000, yUm: node.yUm + 33_000 });
    expect(preview.preview.status).toBe("valid");
    if (preview.preview.status !== "valid") throw new Error("valid preview required");
    expect(preview.preview.metadata.movement).toMatchObject({
      kind: "junction",
      nodeId: id,
      target: { xUm: node.xUm + 50_000, yUm: node.yUm + 50_000 },
    });
    expect(preview.preview.metadata.affectedWallIds.length).toBeGreaterThan(1);
  });

  it("evaluates repeated previews from the original snapshot and commits once", () => {
    const project = createOption3ProjectV2();
    const id = wallId("w-option3-front-wet-split-1");
    const controller = CanonicalDragController.begin(project, { type: "wall", id }, { xUm: 0, yUm: 0 });
    controller.preview({ xUm: 50_000, yUm: 0 });
    const second = controller.preview({ xUm: 100_000, yUm: 0 });
    expect(second.preview.status).toBe("valid");
    if (second.preview.status !== "valid") throw new Error("valid preview required");
    expect(second.preview.metadata.movement).toMatchObject({ offsetUm: 100_000 });
    const committed = controller.commit();
    expect(committed.status).toBe("committed");
    if (committed.status !== "committed") throw new Error("committed result required");
    expect(committed.result.previewCount).toBe(2);
    expect(committed.result.undoableChange.beforeProject).toEqual(project);
    expect(committed.result.undoableChange.afterProject).toEqual(committed.result.project);
  });

  it("shows the last valid geometry but rejects the whole drag on invalid release", () => {
    const project = createOption3ProjectV2();
    const controller = CanonicalDragController.begin(
      project,
      { type: "wall", id: wallId("w-option3-left-outer-1") },
      { xUm: 0, yUm: 0 },
    );
    const valid = controller.preview({ xUm: 100_000, yUm: 0 });
    expect(valid.preview.status).toBe("valid");
    const invalid = controller.preview({ xUm: 20_000_000, yUm: 0 });
    expect(invalid.preview.status).toBe("invalid");
    expect(invalid.displayProject).toEqual(valid.displayProject);
    const finished = controller.commit();
    expect(finished.status).toBe("cancelled");
    if (finished.status !== "cancelled") throw new Error("cancelled result required");
    expect(finished.reason).toBe("invalidRelease");
    expect(finished.result.project).toEqual(project);
    expect(finished.result.undoableChange).toBeNull();
  });

  it.each(["escape", "pointerCancel"] as const)("rolls back exactly on %s", (reason) => {
    const project = createOption3ProjectV2();
    const controller = CanonicalDragController.begin(
      project,
      { type: "wall", id: wallId("w-option3-left-outer-1") },
      { xUm: 0, yUm: 0 },
    );
    controller.preview({ xUm: 100_000, yUm: 0 });
    const cancelled = controller.cancel(reason);
    expect(cancelled.project).toEqual(project);
    expect(cancelled.undoableChange).toBeNull();
  });

  it("allows only a valid latest preview through the commit gate", () => {
    expect(canCommitCanonicalDrag(null)).toBe(false);
    expect(canCommitCanonicalDrag({
      status: "remapRequired",
      sequence: 1,
      source: "projectUpdate",
      errorName: "ProjectTopologyUpdateError",
      reason: "Semantic remapping is required.",
      reconciliation: null,
    })).toBe(false);
  });

  it("supports an event-style zoomed pointer sequence with one history change and exact undo/redo", () => {
    const original = createOption3ProjectV2();
    const transform = { a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 };
    const downClient = { x: 200, y: 200 };
    const start = clientPointToModelUm(downClient, transform);
    expect(exceedsDragActivationThreshold(downClient, { x: 202, y: 200 })).toBe(false);
    expect(exceedsDragActivationThreshold(downClient, { x: 204, y: 200 })).toBe(true);

    const controller = CanonicalDragController.begin(
      original,
      { type: "wall", id: wallId("w-option3-front-wet-split-1") },
      start,
    );
    controller.preview(clientPointToModelUm({ x: 300, y: 220 }, transform));
    controller.preview(clientPointToModelUm({ x: 400, y: 240 }, transform));
    const finished = controller.commit();
    expect(finished.status).toBe("committed");
    if (finished.status !== "committed") throw new Error("committed result required");

    const history = [finished.result.undoableChange];
    expect(history).toHaveLength(1);
    const undone = history[0]!.beforeProject;
    const redone = history[0]!.afterProject;
    expect(undone).toEqual(original);
    expect(redone).toEqual(finished.result.project);
    expect(finished.result.previewCount).toBe(2);
  });
});

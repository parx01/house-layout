import { describe, expect, it } from "vitest";
import { ProjectInteractionController, InteractionLifecycleError } from "../src/interaction/project-interaction.js";
import { coordinateUm } from "../src/core/units.js";
import { createOption3ProjectV2 } from "../src/project/option3-baseline.js";
import type { ProjectV2 } from "../src/project/schema.js";
import { validateProjectV2 } from "../src/project/validation.js";
import { createOption3SemanticSpacesV2 } from "../src/project/option3-semantic-spaces.js";
import { moveWallPerpendicular } from "../src/topology/movement.js";
import { nodeId, wallId, type TopologyV2 } from "../src/topology/model.js";
import { rectangleTopology, twoRoomSharedWallTopology } from "./fixtures/topology.js";

function syntheticProject(topology: TopologyV2): ProjectV2 {
  const baseline = createOption3ProjectV2();
  const insetTopology: TopologyV2 = {
    ...structuredClone(topology),
    nodes: Object.fromEntries(Object.entries(topology.nodes).map(([identity, node]) => [
      identity,
      {
        ...node,
        xUm: coordinateUm(node.xUm + 1_000_000),
        yUm: coordinateUm(node.yUm + 1_000_000),
      },
    ])) as TopologyV2["nodes"],
  };
  return validateProjectV2({
    ...structuredClone(baseline),
    topology: insetTopology,
    spaces: { status: "deferred", targetStage: "A2", modelVersion: null, data: null },
  });
}

function option3Project(): ProjectV2 {
  const project = createOption3ProjectV2();
  return validateProjectV2({ ...structuredClone(project), spaces: createOption3SemanticSpacesV2() });
}

describe("B0 project interaction transaction lifecycle", () => {
  it("begins from an immutable snapshot and commits multiple previews as one undoable change", () => {
    const original = syntheticProject(twoRoomSharedWallTopology());
    const originalJson = JSON.stringify(original);
    const controller = ProjectInteractionController.begin(original);

    const first = controller.preview((topology) =>
      moveWallPerpendicular(topology, wallId("w-shared"), 100_000));
    const second = controller.preview((topology) =>
      moveWallPerpendicular(topology, wallId("w-shared"), 300_000));
    expect(first.status).toBe("valid");
    expect(second.status).toBe("valid");
    expect(Object.isFrozen(controller.snapshot().originalProject)).toBe(true);
    if (second.status !== "valid" || original.topology.status !== "active" || second.candidateProject.topology.status !== "active") {
      throw new Error("Active valid preview required.");
    }
    expect(
      second.candidateProject.topology.nodes[nodeId("n-2")]!.xUm -
        original.topology.nodes[nodeId("n-2")]!.xUm,
    ).toBe(300_000);
    expect(controller.snapshot().committedProject).toEqual(original);
    expect(JSON.stringify(original)).toBe(originalJson);

    const completed = controller.commit();
    expect(completed.status).toBe("committed");
    if (completed.status !== "committed") throw new Error("Committed interaction required.");
    expect(completed.previewCount).toBe(2);
    expect(completed.undoableChange.beforeProject).toEqual(original);
    expect(completed.undoableChange.afterProject).toEqual(completed.project);
    expect(completed.undoableChange.metadata.affectedWallIds).toContain("w-shared");
    expect(completed.undoableChange.metadata.footprintChanged).toBe(false);
    expect(controller.snapshot().phase).toBe("completed");
    expect(() => controller.commit()).toThrow(InteractionLifecycleError);
  });

  it.each(["escape", "pointerCancel"] as const)("%s cancels with exact rollback", (reason) => {
    const original = syntheticProject(rectangleTopology());
    const originalJson = JSON.stringify(original);
    const controller = ProjectInteractionController.begin(original);
    const preview = controller.preview((topology) =>
      moveWallPerpendicular(topology, wallId("w-left"), 250_000));
    expect(preview.status).toBe("valid");

    const cancelled = controller.cancel(reason);
    expect(cancelled.project).toEqual(original);
    expect(JSON.stringify(cancelled.project)).toBe(originalJson);
    expect(cancelled.undoableChange).toBeNull();
    expect(controller.snapshot().committedProject).toEqual(original);
    expect(() => controller.preview((topology) =>
      moveWallPerpendicular(topology, wallId("w-left"), 100_000))).toThrow(InteractionLifecycleError);
  });

  it("keeps the committed and last-valid states intact after an invalid preview", () => {
    const original = syntheticProject(rectangleTopology());
    const controller = ProjectInteractionController.begin(original);
    const valid = controller.preview((topology) =>
      moveWallPerpendicular(topology, wallId("w-left"), 250_000));
    expect(valid.status).toBe("valid");

    const invalid = controller.preview((topology) =>
      moveWallPerpendicular(topology, wallId("w-left"), 4_000_000));
    expect(invalid.status).toBe("invalid");
    if (invalid.status === "valid") throw new Error("Invalid preview required.");
    expect(invalid.reason.length).toBeGreaterThan(0);
    const active = controller.snapshot();
    expect(active.committedProject).toEqual(original);
    expect(active.latestPreview?.status).toBe("invalid");
    expect(active.lastValidPreview).toEqual(valid);

    const completed = controller.commit();
    expect(completed.status).toBe("committed");
    if (completed.status !== "committed" || valid.status !== "valid") {
      throw new Error("Last valid preview must commit.");
    }
    expect(completed.project).toEqual(valid.candidateProject);
    expect(completed.previewCount).toBe(2);
  });

  it("completes an all-invalid gesture without a project or undo change", () => {
    const original = syntheticProject(rectangleTopology());
    const controller = ProjectInteractionController.begin(original);
    expect(controller.preview((topology) =>
      moveWallPerpendicular(topology, wallId("w-left"), 4_000_000)).status).toBe("invalid");
    const completed = controller.commit();
    expect(completed.status).toBe("noChange");
    expect(completed.project).toEqual(original);
    expect(completed.undoableChange).toBeNull();
  });

  it("exposes complete semantic and footprint metadata for an Option-3 internal gesture", () => {
    const original = option3Project();
    const controller = ProjectInteractionController.begin(original);
    const preview = controller.preview((topology) =>
      moveWallPerpendicular(topology, wallId("w-option3-front-wet-split-1"), 100_000));
    expect(preview.status).toBe("valid");
    if (preview.status !== "valid") throw new Error("Valid preview required.");
    expect(preview.metadata.footprintChanged).toBe(false);
    expect(preview.metadata.involvedWallClassifications.internalSharedWallIds).toContain(
      "w-option3-front-wet-split-1",
    );
    expect(preview.metadata.semanticReconciliation.status).toBe("resolved");
    expect(preview.metadata.semanticReconciliation.preservedBindings).toHaveLength(13);
    expect(preview.candidateProject.spaces).toEqual(original.spaces);
    expect(controller.snapshot().committedProject).toEqual(original);
  });

  it("reports an Option-3 exterior preview as footprint-changing before commit", () => {
    const original = option3Project();
    const controller = ProjectInteractionController.begin(original);
    const preview = controller.preview((topology) =>
      moveWallPerpendicular(topology, wallId("w-option3-left-outer-1"), 100_000));
    expect(preview.status).toBe("valid");
    if (preview.status !== "valid") throw new Error("Valid preview required.");
    expect(preview.metadata.footprintChanged).toBe(true);
    expect(preview.metadata.involvedWallClassifications.exteriorWallIds).toContain(
      "w-option3-left-outer-1",
    );
    expect(controller.snapshot().committedProject).toEqual(original);
  });
});

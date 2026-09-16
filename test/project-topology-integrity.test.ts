import { describe, expect, it } from "vitest";
import {
  loadProjectValue,
  parseProjectJson,
  updateProjectFromLegacyEditorState,
} from "../src/persistence/project-storage.js";
import {
  createOption3ProjectV2,
  OPTION_3_V1_RECOVERY_STATE,
} from "../src/project/option3-baseline.js";
import { createOption3TopologyV2 } from "../src/project/option3-topology.js";
import type { LegacyEditorStateV1 } from "../src/project/schema.js";
import { validateProjectV2 } from "../src/project/validation.js";

function editableBaseline(): LegacyEditorStateV1 {
  return structuredClone(createOption3ProjectV2().legacyEditorState);
}

function deferredTopology() {
  return { status: "deferred", targetStage: "A2", modelVersion: null, data: null } as const;
}

describe("A2.6.1 authority transition and retained topology integrity", () => {
  it("aligns the active baseline topology and building status", () => {
    const project = validateProjectV2(createOption3ProjectV2());
    expect(project.schemaRevision).toBe(6);
    expect(project.topology).toEqual(createOption3TopologyV2());
    expect(project.topology.status).toBe("active");
    expect(project.building.status).toBe("topologyActive");
    expect(project.legacyEditorState.site).toEqual({ width: 14_986, depth: 24_130, coverageLimit: 0.66 });
  });

  it.each([
    ["room move", (state: LegacyEditorStateV1) => { state.rooms[0]!.x += 1; }],
    ["room resize", (state: LegacyEditorStateV1) => { state.rooms[0]!.width += 1; }],
    ["room removal", (state: LegacyEditorStateV1) => { state.rooms.pop(); }],
    ["room wall deletion", (state: LegacyEditorStateV1) => { state.rooms[0]!.hiddenSides.push("top"); }],
    ["legacy wall insertion", (state: LegacyEditorStateV1) => {
      state.walls.push({ id: "wall-edited", x1: 1, y1: 1, x2: 2, y2: 1 });
    }],
  ])("keeps canonical topology authoritative after a legacy-reference %s", (_label, mutate) => {
    const before = createOption3ProjectV2();
    const edited = editableBaseline();
    mutate(edited);
    const after = updateProjectFromLegacyEditorState(before, edited);
    expect(after.topology).toEqual(before.topology);
    expect(after.building.status).toBe("topologyActive");
    expect(after.legacyEditorState).toEqual(edited);
  });

  it("keeps active topology for a containing site edit and rejects a site that clips it", () => {
    const before = createOption3ProjectV2();
    const expanded = editableBaseline();
    expanded.site.width = 16_000;
    expect(updateProjectFromLegacyEditorState(before, expanded).topology).toEqual(before.topology);

    const clipped = editableBaseline();
    clipped.site.width = 10_000;
    expect(() => updateProjectFromLegacyEditorState(before, clipped)).toThrow(/outside the current site boundary/);
    expect(before).toEqual(createOption3ProjectV2());
  });

  it.each([
    ["reference visibility", (state: LegacyEditorStateV1) => { state.reference.show = false; }],
    ["reference opacity", (state: LegacyEditorStateV1) => { state.reference.opacity = 0.61; }],
    ["snap toggle", (state: LegacyEditorStateV1) => { state.snap = false; }],
    ["label toggle", (state: LegacyEditorStateV1) => { state.showLabels = false; }],
    ["room label", (state: LegacyEditorStateV1) => { state.rooms[0]!.name = "Rear room"; }],
    ["coverage inclusion", (state: LegacyEditorStateV1) => { state.rooms[0]!.included = false; }],
    ["legacy common-area estimate", (state: LegacyEditorStateV1) => { state.commonAreaMm2 += 1; }],
  ])("preserves active topology after a non-geometry %s change", (_label, mutate) => {
    const before = createOption3ProjectV2();
    const edited = editableBaseline();
    mutate(edited);
    const after = updateProjectFromLegacyEditorState(before, edited);
    expect(after.topology).toEqual(before.topology);
    expect(after.building.status).toBe("topologyActive");
  });

  it("does not automatically attach stock topology to edited or arbitrary V1 input", () => {
    const edited = structuredClone(OPTION_3_V1_RECOVERY_STATE);
    edited.rooms[0]!.x += 100;
    const recoveredEdited = loadProjectValue({ version: 1, ...edited });
    expect(recoveredEdited.topology).toEqual(deferredTopology());
    expect(recoveredEdited.building.status).toBe("topologyDeferred");

    const arbitrarySite = structuredClone(OPTION_3_V1_RECOVERY_STATE);
    arbitrarySite.site.width = 14_000;
    const recoveredArbitrary = loadProjectValue({ version: 1, ...arbitrarySite });
    expect(recoveredArbitrary.topology).toEqual(deferredTopology());
    expect(recoveredArbitrary.site.boundary.widthUm).toBe(14_000_000);
  });

  it("attaches stock topology only to baseline geometry, allowing presentation differences", () => {
    const source = structuredClone(OPTION_3_V1_RECOVERY_STATE);
    source.reference.show = false;
    source.reference.opacity = 0.5;
    source.snap = false;
    source.showLabels = false;
    const recovered = loadProjectValue({ version: 1, ...source });
    expect(recovered.topology).toEqual(createOption3TopologyV2());
    expect(recovered.building.status).toBe("topologyActive");
  });

  it("accepts active topology independently of divergent legacy-reference rectangles", () => {
    const project = structuredClone(createOption3ProjectV2()) as any;
    project.legacyEditorState.rooms[0].x += 1;
    expect(validateProjectV2(project).topology).toEqual(project.topology);
  });

  it("accepts a structurally valid active graph without requiring curated-baseline equality", () => {
    const project = structuredClone(createOption3ProjectV2()) as any;
    const firstWall = Object.values(project.topology.walls)[0] as any;
    firstWall.thicknessUm += 1;
    expect(validateProjectV2(project).topology).toEqual(project.topology);
  });

  it("rejects building status that disagrees with topology state", () => {
    const activeMismatch = structuredClone(createOption3ProjectV2()) as any;
    activeMismatch.building.status = "topologyDeferred";
    expect(() => validateProjectV2(activeMismatch)).toThrow("project.building.status must equal \"topologyActive\"");

    const deferredMismatch = structuredClone(createOption3ProjectV2()) as any;
    deferredMismatch.topology = deferredTopology();
    expect(() => validateProjectV2(deferredMismatch)).toThrow("project.building.status must equal \"topologyDeferred\"");
  });

  it("rejects active topology centre-lines and thickness bands outside the current site", () => {
    const centreOutside = structuredClone(createOption3ProjectV2()) as any;
    centreOutside.site.boundary.widthUm = 10_000_000;
    expect(() => validateProjectV2(centreOutside)).toThrow(/node .* lies outside the current site boundary/);

    const bandOutside = structuredClone(createOption3ProjectV2()) as any;
    bandOutside.site.boundary.widthUm = 13_500_000;
    expect(() => validateProjectV2(bandOutside)).toThrow(/wall .* thickness band lies outside the current site boundary/);
  });

  it("migrates revision-2 active and deferred saves to the current truthful status", () => {
    const activeRevision2 = structuredClone(createOption3ProjectV2()) as any;
    activeRevision2.schemaRevision = 2;
    activeRevision2.building.status = "deferredToTopologyA2";
    activeRevision2.spaces = deferredTopology();
    activeRevision2.legacyEditorState.site.width = OPTION_3_V1_RECOVERY_STATE.site.width;
    activeRevision2.legacyEditorState.site.depth = OPTION_3_V1_RECOVERY_STATE.site.depth;
    const active = parseProjectJson(JSON.stringify(activeRevision2));
    expect(active.schemaRevision).toBe(6);
    expect(active.topology.status).toBe("active");
    expect(active.building.status).toBe("topologyActive");
    expect(active.legacyEditorState.site).toEqual({ width: 14_986, depth: 24_130, coverageLimit: 0.66 });

    const deferredRevision2 = structuredClone(activeRevision2);
    deferredRevision2.topology = deferredTopology();
    const deferred = parseProjectJson(JSON.stringify(deferredRevision2));
    expect(deferred.schemaRevision).toBe(6);
    expect(deferred.topology.status).toBe("deferred");
    expect(deferred.building.status).toBe("topologyDeferred");
  });
});

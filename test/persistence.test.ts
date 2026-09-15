import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOption3ProjectV2, OPTION_3_V1_RECOVERY_STATE } from "../src/project/option3-baseline.js";
import {
  loadProjectValue,
  parseProjectJson,
  projectToLegacyEditorState,
  serializeProject,
  UnsupportedProjectVersionError,
} from "../src/persistence/project-storage.js";
import { ProjectValidationError } from "../src/project/validation.js";

describe("ProjectV2 validation and legacy recovery", () => {
  it("round-trips a strictly validated ProjectV2 project", () => {
    const project = createOption3ProjectV2();
    expect(parseProjectJson(serializeProject(project))).toEqual(project);
  });

  it("preserves active topology and stable IDs through ProjectV2 save/load", () => {
    const project = createOption3ProjectV2();
    const recovered = parseProjectJson(serializeProject(project));
    expect(recovered.topology).toEqual(project.topology);
    expect(recovered.topology.status).toBe("active");
    expect(recovered.building.status).toBe("topologyActive");
  });

  it("recovers an A1-era ProjectV2 save through the explicit revision migration", () => {
    const a1Save = structuredClone(createOption3ProjectV2()) as unknown as Record<string, any>;
    delete a1Save.schemaRevision;
    delete a1Save.topology;
    delete a1Save.spaces;
    delete a1Save.openings;
    delete a1Save.dimensions;
    delete a1Save.siteObjects;
    delete a1Save.site.road.widthProvenance;
    a1Save.building.status = "deferredToTopologyA2";

    const recovered = parseProjectJson(JSON.stringify(a1Save));
    expect(recovered.schemaVersion).toBe(2);
    expect(recovered.schemaRevision).toBe(4);
    expect(recovered.legacyEditorState).toEqual(a1Save.legacyEditorState);
    expect(recovered.topology).toEqual({ status: "deferred", targetStage: "A2", modelVersion: null, data: null });
    expect(recovered.building.status).toBe("topologyDeferred");
    expect(recovered.spaces).toEqual({ status: "deferred", targetStage: "A2", modelVersion: null, data: null });
    expect(recovered.openings.targetStage).toBe("postA2");
    expect(recovered.dimensions.targetStage).toBe("A2");
    expect(recovered.siteObjects.targetStage).toBe("postA2");
    expect(parseProjectJson(serializeProject(recovered))).toEqual(recovered);
  });

  it("rejects unsupported schema versions explicitly", () => {
    expect(() => loadProjectValue({ schemaVersion: 3 })).toThrow(UnsupportedProjectVersionError);
    expect(() => loadProjectValue({ version: 99 })).toThrow("Unsupported project schema version: 99");
  });

  it("rejects corrupt JSON explicitly", () => {
    expect(() => parseProjectJson("{broken")).toThrow(ProjectValidationError);
    expect(() => parseProjectJson("{broken")).toThrow("Project JSON is corrupt");
  });

  it("rejects unknown fields instead of shallow-merging them", () => {
    const value = structuredClone(createOption3ProjectV2()) as unknown as Record<string, unknown>;
    value.unexpected = true;
    expect(() => loadProjectValue(value)).toThrow("project.unexpected is not supported");
  });

  it("rejects a road width that contradicts its reference-plan provenance", () => {
    const value = structuredClone(createOption3ProjectV2());
    (value.site.road as { widthUm: number | null }).widthUm = 10_000_000;
    expect(() => loadProjectValue(value)).toThrow("must equal the 12,000,000 um value stated by OPTION-3.pdf");
  });

  it("keeps the immutable V1 fixture recoverable without topology inference", () => {
    const fixture = JSON.parse(readFileSync(new URL("../fixtures/option-3-v1.json", import.meta.url), "utf8"));
    expect(fixture).toEqual(OPTION_3_V1_RECOVERY_STATE);
    const recovered = loadProjectValue(fixture);
    expect(recovered.schemaVersion).toBe(2);
    expect(recovered.legacyEditorState.rooms).toEqual(OPTION_3_V1_RECOVERY_STATE.rooms);
    expect(recovered.legacyEditorState.site).toEqual({ width: 14_986, depth: 24_130, coverageLimit: 0.66 });
    expect(recovered.topology.status).toBe("active");
    expect(projectToLegacyEditorState(recovered).rooms).toEqual(OPTION_3_V1_RECOVERY_STATE.rooms);
  });
});

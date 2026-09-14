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

  it("keeps the immutable V1 fixture recoverable without topology inference", () => {
    const fixture = JSON.parse(readFileSync(new URL("../fixtures/option-3-v1.json", import.meta.url), "utf8"));
    expect(fixture).toEqual(OPTION_3_V1_RECOVERY_STATE);
    const recovered = loadProjectValue(fixture);
    expect(recovered.schemaVersion).toBe(2);
    expect(recovered.legacyEditorState).toEqual(OPTION_3_V1_RECOVERY_STATE);
    expect(projectToLegacyEditorState(recovered).rooms).toEqual(OPTION_3_V1_RECOVERY_STATE.rooms);
  });
});

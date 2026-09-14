import { legacyMmToUm, umToLegacyMm } from "../core/units.js";
import { createOption3ProjectV2 } from "../project/option3-baseline.js";
import type { LegacyEditorStateV1, ProjectV2 } from "../project/schema.js";
import {
  detectProjectVersion,
  normalizeProjectV2,
  ProjectValidationError,
  UnsupportedProjectVersionError,
  validateLegacyProjectEnvelopeV1,
  validateProjectV2,
} from "../project/validation.js";

export const PROJECT_V2_STORAGE_KEY = "plan66-option3-v2";
export const LEGACY_V1_STORAGE_KEY = "plan66-option3-v1";

export function parseProjectJson(json: string): ProjectV2 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new ProjectValidationError(`Project JSON is corrupt: ${error instanceof Error ? error.message : "invalid JSON"}`);
  }
  return loadProjectValue(parsed);
}

export function loadProjectValue(value: unknown): ProjectV2 {
  const version = detectProjectVersion(value);
  if (version === 2) return normalizeProjectV2(value);
  const legacy = validateLegacyProjectEnvelopeV1(value);
  return createOption3ProjectV2(legacy);
}

export function serializeProject(project: ProjectV2): string {
  return JSON.stringify(validateProjectV2(project), null, 2);
}

export function projectToLegacyEditorState(project: ProjectV2): LegacyEditorStateV1 {
  const validated = validateProjectV2(project);
  const state = structuredClone(validated.legacyEditorState);
  state.site = {
    width: umToLegacyMm(validated.site.boundary.widthUm),
    depth: umToLegacyMm(validated.site.boundary.depthUm),
    coverageLimit: validated.site.coverageRule.numerator / validated.site.coverageRule.denominator,
  };
  return state;
}

export function updateProjectFromLegacyEditorState(project: ProjectV2, legacyState: LegacyEditorStateV1): ProjectV2 {
  const next = structuredClone(validateProjectV2(project));
  const validatedLegacy = validateLegacyProjectEnvelopeV1(legacyState);
  next.site = {
    ...next.site,
    boundary: {
      ...next.site.boundary,
      widthUm: legacyMmToUm(validatedLegacy.site.width),
      depthUm: legacyMmToUm(validatedLegacy.site.depth),
    },
  };
  next.legacyEditorState = structuredClone(validatedLegacy);
  return validateProjectV2(next);
}

export function readProjectFromStorage(storage: Pick<Storage, "getItem">): ProjectV2 {
  const current = storage.getItem(PROJECT_V2_STORAGE_KEY);
  if (current !== null) return parseProjectJson(current);
  const legacy = storage.getItem(LEGACY_V1_STORAGE_KEY);
  if (legacy !== null) return parseProjectJson(legacy);
  return createOption3ProjectV2();
}

export function writeProjectToStorage(storage: Pick<Storage, "setItem">, project: ProjectV2): void {
  storage.setItem(PROJECT_V2_STORAGE_KEY, serializeProject(project));
}

export { ProjectValidationError, UnsupportedProjectVersionError };

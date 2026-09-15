import { legacyMmToUm, umToLegacyMm } from "../core/units.js";
import { createOption3ProjectV2 } from "../project/option3-baseline.js";
import { detectProjectVersion, normalizeProjectV2, ProjectValidationError, UnsupportedProjectVersionError, validateLegacyProjectEnvelopeV1, validateProjectV2, } from "../project/validation.js";
export const PROJECT_V2_STORAGE_KEY = "plan66-option3-v2";
export const LEGACY_V1_STORAGE_KEY = "plan66-option3-v1";
export function parseProjectJson(json) {
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch (error) {
        throw new ProjectValidationError(`Project JSON is corrupt: ${error instanceof Error ? error.message : "invalid JSON"}`);
    }
    return loadProjectValue(parsed);
}
export function loadProjectValue(value) {
    const version = detectProjectVersion(value);
    if (version === 2)
        return normalizeProjectV2(value);
    const legacy = validateLegacyProjectEnvelopeV1(value);
    return validateProjectV2(createOption3ProjectV2(legacy));
}
export function serializeProject(project) {
    return JSON.stringify(validateProjectV2(project), null, 2);
}
export function projectToLegacyEditorState(project) {
    const validated = validateProjectV2(project);
    const state = structuredClone(validated.legacyEditorState);
    state.site = {
        width: umToLegacyMm(validated.site.boundary.widthUm),
        depth: umToLegacyMm(validated.site.boundary.depthUm),
        coverageLimit: validated.site.coverageRule.numerator / validated.site.coverageRule.denominator,
    };
    return state;
}
export function updateProjectFromLegacyEditorState(project, legacyState) {
    const current = validateProjectV2(project);
    const validatedLegacy = validateLegacyProjectEnvelopeV1(legacyState);
    const next = {
        ...structuredClone(current),
        site: {
            ...current.site,
            boundary: {
                ...current.site.boundary,
                widthUm: legacyMmToUm(validatedLegacy.site.width),
                depthUm: legacyMmToUm(validatedLegacy.site.depth),
            },
        },
        building: {
            ...current.building,
            status: current.topology.status === "active" ? "topologyActive" : "topologyDeferred",
        },
        legacyEditorState: structuredClone(validatedLegacy),
    };
    return validateProjectV2(next);
}
export function readProjectFromStorage(storage) {
    const current = storage.getItem(PROJECT_V2_STORAGE_KEY);
    if (current !== null)
        return parseProjectJson(current);
    const legacy = storage.getItem(LEGACY_V1_STORAGE_KEY);
    if (legacy !== null)
        return parseProjectJson(legacy);
    return createOption3ProjectV2();
}
export function writeProjectToStorage(storage, project) {
    storage.setItem(PROJECT_V2_STORAGE_KEY, serializeProject(project));
}
export { ProjectValidationError, UnsupportedProjectVersionError };
//# sourceMappingURL=project-storage.js.map
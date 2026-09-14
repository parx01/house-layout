import type { LegacyEditorStateV1, ProjectV2 } from "../project/schema.js";
import { ProjectValidationError, UnsupportedProjectVersionError } from "../project/validation.js";
export declare const PROJECT_V2_STORAGE_KEY = "plan66-option3-v2";
export declare const LEGACY_V1_STORAGE_KEY = "plan66-option3-v1";
export declare function parseProjectJson(json: string): ProjectV2;
export declare function loadProjectValue(value: unknown): ProjectV2;
export declare function serializeProject(project: ProjectV2): string;
export declare function projectToLegacyEditorState(project: ProjectV2): LegacyEditorStateV1;
export declare function updateProjectFromLegacyEditorState(project: ProjectV2, legacyState: LegacyEditorStateV1): ProjectV2;
export declare function readProjectFromStorage(storage: Pick<Storage, "getItem">): ProjectV2;
export declare function writeProjectToStorage(storage: Pick<Storage, "setItem">, project: ProjectV2): void;
export { ProjectValidationError, UnsupportedProjectVersionError };
//# sourceMappingURL=project-storage.d.ts.map
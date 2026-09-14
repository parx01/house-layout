import type { LegacyEditorStateV1, LegacyProjectEnvelopeV1, ProjectV2 } from "./schema.js";
export declare class ProjectValidationError extends Error {
    constructor(message: string);
}
export declare class UnsupportedProjectVersionError extends Error {
    readonly version: unknown;
    constructor(version: unknown);
}
export declare function validateLegacyEditorStateV1(value: unknown, path?: string): LegacyEditorStateV1;
export declare function validateProjectV2(value: unknown): ProjectV2;
export declare function detectProjectVersion(value: unknown): 1 | 2;
export declare function validateLegacyProjectEnvelopeV1(value: unknown): LegacyProjectEnvelopeV1;
//# sourceMappingURL=validation.d.ts.map
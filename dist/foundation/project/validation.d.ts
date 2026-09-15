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
/**
 * ProjectV2 A1 files predate schemaRevision and the reserved model slots. This
 * explicit one-way normalization keeps those saves recoverable without treating
 * the legacy room rectangles as topology.
 */
export declare function normalizeProjectV2(value: unknown): ProjectV2;
export declare function migrateProjectV2A1ToRevision5(value: unknown): ProjectV2;
export declare function migrateProjectV2Revision2To5(value: unknown): ProjectV2;
/**
 * Revision 3 required the spaces slot to be deferred. Validate that historical
 * meaning before permitting semantic spaces in later revisions.
 */
export declare function migrateProjectV2Revision3To5(value: unknown): ProjectV2;
/** Revision 4 introduced active semantic spaces while retaining the legacy authority restriction. */
export declare function migrateProjectV2Revision4To5(value: unknown): ProjectV2;
/** @deprecated Use migrateProjectV2A1ToRevision5. Retained as a source-compatible normalizer. */
export declare const migrateProjectV2A1ToRevision3: typeof migrateProjectV2A1ToRevision5;
/** @deprecated Use migrateProjectV2A1ToRevision5. Retained as a source-compatible normalizer. */
export declare const migrateProjectV2A1ToRevision4: typeof migrateProjectV2A1ToRevision5;
/** @deprecated Use migrateProjectV2Revision2To5. Retained as a source-compatible normalizer. */
export declare const migrateProjectV2Revision2To3: typeof migrateProjectV2Revision2To5;
/** @deprecated Use migrateProjectV2Revision2To5. Retained as a source-compatible normalizer. */
export declare const migrateProjectV2Revision2To4: typeof migrateProjectV2Revision2To5;
/** @deprecated Use migrateProjectV2Revision3To5. Retained as a source-compatible normalizer. */
export declare const migrateProjectV2Revision3To4: typeof migrateProjectV2Revision3To5;
export declare function detectProjectVersion(value: unknown): 1 | 2;
export declare function validateLegacyProjectEnvelopeV1(value: unknown): LegacyProjectEnvelopeV1;
//# sourceMappingURL=validation.d.ts.map
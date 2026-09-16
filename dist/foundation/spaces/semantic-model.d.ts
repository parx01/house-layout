import { type FaceId } from "./model.js";
import type { TopologyV2 } from "../topology/model.js";
declare const spaceIdBrand: unique symbol;
export type SpaceId = string & {
    readonly [spaceIdBrand]: "SpaceId";
};
export declare const SPACE_CATEGORIES: readonly ["room", "circulation", "service", "storage", "other"];
export type SpaceCategory = (typeof SPACE_CATEGORIES)[number];
export declare const ARCHITECTURAL_SPACE_ROLES: readonly ["ordinaryRoom", "circulation", "staircase", "service", "storage", "courtyardVoid", "otherSpecialUse", "unclassified"];
export type ArchitecturalSpaceRole = (typeof ARCHITECTURAL_SPACE_ROLES)[number];
export declare const SPACE_ENCLOSURES: readonly ["enclosedCovered", "openToSky", "unclassified"];
export type SpaceEnclosure = (typeof SPACE_ENCLOSURES)[number];
export interface SemanticSpaceV1 {
    readonly id: SpaceId;
    readonly name: string;
    readonly category: SpaceCategory;
    /** Current binding only; the face polygon and area remain derived. */
    readonly faceId: FaceId;
}
export interface SemanticSpacesV1 {
    readonly status: "active";
    readonly modelVersion: 1;
    readonly spaces: readonly SemanticSpaceV1[];
}
export interface SemanticSpaceV2 extends SemanticSpaceV1 {
    /** Explicit architectural meaning; never inferred from the base category. */
    readonly architecturalRole: ArchitecturalSpaceRole;
    /** Physical enclosure only. A4 separately owns whether/how this counts as coverage. */
    readonly enclosure: SpaceEnclosure;
}
export interface SemanticSpacesV2 {
    readonly status: "active";
    readonly modelVersion: 2;
    readonly spaces: readonly SemanticSpaceV2[];
}
export declare class SemanticSpaceValidationError extends Error {
    constructor(message: string);
}
export declare function spaceId(value: string): SpaceId;
/**
 * Validates persistent semantics against the current derived face set. This
 * never copies face polygons or areas into the semantic model.
 */
export declare function validateSemanticSpacesV1(value: unknown, topology: TopologyV2, path?: string): SemanticSpacesV1;
export declare function validateSemanticSpacesV2(value: unknown, topology: TopologyV2, path?: string): SemanticSpacesV2;
/**
 * Validates the stronger A3-closure contract required before deriving a fully
 * understood architectural model. Historical migrations may remain
 * structurally active with explicit `unclassified` values; they must not pass
 * this gate until a human completes their classification.
 */
export declare function validateCompleteSemanticSpacesV2(value: unknown, topology: TopologyV2, path?: string): SemanticSpacesV2;
/** Revision-safe migration. Unknown V1 intent stays explicit instead of being guessed from category/name. */
export declare function migrateSemanticSpacesV1ToV2(value: unknown, topology: TopologyV2, path?: string): SemanticSpacesV2;
export {};
//# sourceMappingURL=semantic-model.d.ts.map
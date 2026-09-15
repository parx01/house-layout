import { type FaceId } from "./model.js";
import type { TopologyV2 } from "../topology/model.js";
declare const spaceIdBrand: unique symbol;
export type SpaceId = string & {
    readonly [spaceIdBrand]: "SpaceId";
};
export declare const SPACE_CATEGORIES: readonly ["room", "circulation", "service", "storage", "other"];
export type SpaceCategory = (typeof SPACE_CATEGORIES)[number];
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
export declare class SemanticSpaceValidationError extends Error {
    constructor(message: string);
}
export declare function spaceId(value: string): SpaceId;
/**
 * Validates persistent semantics against the current derived face set. This
 * never copies face polygons or areas into the semantic model.
 */
export declare function validateSemanticSpacesV1(value: unknown, topology: TopologyV2, path?: string): SemanticSpacesV1;
export {};
//# sourceMappingURL=semantic-model.d.ts.map
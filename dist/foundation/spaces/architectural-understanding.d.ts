import type { AreaUm2, LengthUm } from "../core/units.js";
import { type TopologyV2, type WallId } from "../topology/model.js";
import type { DerivedBoundedFace, FaceId } from "./model.js";
import { type ArchitecturalSpaceRole, type SemanticSpacesV2, type SpaceCategory, type SpaceEnclosure, type SpaceId } from "./semantic-model.js";
export interface ArchitecturalPoint {
    /** Exact to 0.25 µm; wall faces themselves are exact to 0.5 µm. */
    readonly xUm: number;
    readonly yUm: number;
}
export interface ArchitecturalWallUnderstanding {
    readonly wallId: WallId;
    readonly centreLineLengthUm: LengthUm;
    readonly thicknessUm: LengthUm;
}
export interface AdjacentSemanticSpace {
    readonly spaceId: SpaceId;
    readonly wallIds: readonly WallId[];
}
export interface SharedWallRelationship {
    readonly wallId: WallId;
    readonly spaceIds: readonly [SpaceId, SpaceId];
    readonly thicknessUm: LengthUm;
    readonly centreLineLengthUm: LengthUm;
}
export interface ClearDimensionSegment {
    readonly orientation: "horizontal" | "vertical";
    readonly lengthUm: number;
    readonly start: ArchitecturalPoint;
    readonly end: ArchitecturalPoint;
}
export type ClearGeometryUnderstanding = {
    readonly status: "simpleRectangle";
    /** Clear wall-face to wall-face width, not a centre-line span. */
    readonly widthUm: number;
    /** Clear wall-face to wall-face depth, not a centre-line span. */
    readonly depthUm: number;
    readonly clearAreaUm2: number;
    readonly horizontalSegments: readonly ClearDimensionSegment[];
    readonly verticalSegments: readonly ClearDimensionSegment[];
} | {
    readonly status: "notSimpleRectangle";
    readonly clearAreaUm2: number;
    readonly horizontalSegments: readonly ClearDimensionSegment[];
    readonly verticalSegments: readonly ClearDimensionSegment[];
} | {
    readonly status: "noClearInterior";
    readonly clearAreaUm2: 0;
    readonly horizontalSegments: readonly [];
    readonly verticalSegments: readonly [];
};
export interface SemanticSpaceUnderstanding {
    readonly spaceId: SpaceId;
    readonly name: string;
    readonly category: SpaceCategory;
    readonly architecturalRole: ArchitecturalSpaceRole;
    readonly enclosure: SpaceEnclosure;
    readonly faceId: FaceId;
    /** Exact centre-line face from A2.4. This is not clear usable floor geometry. */
    readonly face: DerivedBoundedFace;
    readonly centreLineAreaUm2: AreaUm2;
    readonly surroundingWallIds: readonly WallId[];
    readonly walls: readonly ArchitecturalWallUnderstanding[];
    readonly adjacentSpaces: readonly AdjacentSemanticSpace[];
    readonly boundaryWallIds: readonly WallId[];
    readonly clearGeometry: ClearGeometryUnderstanding;
    readonly labelAnchor: ArchitecturalPoint & {
        readonly basis: "largestClearInteriorRectangle" | "centreLineInteriorFallback";
    };
}
export interface ArchitecturalUnderstandingV1 {
    readonly modelVersion: 1;
    readonly topologyModelVersion: 1;
    readonly semanticModelVersion: 2;
    readonly spaces: readonly SemanticSpaceUnderstanding[];
    readonly sharedWalls: readonly SharedWallRelationship[];
    readonly unclaimedFaceIds: readonly FaceId[];
}
/**
 * Pure runtime derivation from canonical topology, A2.4 faces, and A3 spaces.
 * No result from this function is persisted as architectural source geometry.
 */
export declare function deriveArchitecturalUnderstanding(topologyValue: TopologyV2, spacesValue: SemanticSpacesV2): ArchitecturalUnderstandingV1;
//# sourceMappingURL=architectural-understanding.d.ts.map
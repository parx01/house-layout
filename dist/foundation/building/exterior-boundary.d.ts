import type { DerivedFaceVertex, DirectedWallHalfEdgeRef } from "../spaces/model.js";
import type { TopologyV2, WallId } from "../topology/model.js";
export declare class ExteriorBoundaryDerivationError extends Error {
    constructor(message: string);
}
export interface DerivedExteriorBoundaryLoop {
    readonly winding: "clockwise";
    readonly boundary: readonly DirectedWallHalfEdgeRef[];
    readonly vertices: readonly DerivedFaceVertex[];
}
export interface DerivedExteriorBoundaryV1 {
    readonly modelVersion: 1;
    readonly topologyModelVersion: 1;
    /** Walls separating one bounded face from the unbounded exterior. */
    readonly exteriorWallIds: readonly WallId[];
    /** Walls used by two bounded faces, independent of semantic room meaning. */
    readonly internalSharedWallIds: readonly WallId[];
    /** Bridges/dangling walls that do not bound any face. */
    readonly nonFaceBoundaryWallIds: readonly WallId[];
    readonly loops: readonly DerivedExteriorBoundaryLoop[];
}
/**
 * Purely derives the building-to-unbounded-plane boundary from canonical
 * topology and A2.4 face incidence. No semantic or legacy geometry is read.
 */
export declare function deriveExteriorBoundary(topologyValue: TopologyV2): DerivedExteriorBoundaryV1;
//# sourceMappingURL=exterior-boundary.d.ts.map
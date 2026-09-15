import { type AreaUm2, type CoordinateUm } from "../core/units.js";
import type { FaceId } from "../spaces/model.js";
import { type NodeId, type TopologyV2, type WallId, type WallOrientation } from "./model.js";
export type TopologyMoveFailureStage = "input" | "candidateTopology" | "candidateFaces" | "facePreservation";
export declare class TopologyMoveError extends Error {
    readonly stage: TopologyMoveFailureStage;
    constructor(stage: TopologyMoveFailureStage, message: string, options?: ErrorOptions);
}
export interface NodeCoordinateChange {
    readonly nodeId: NodeId;
    readonly before: TopologyMovePoint;
    readonly after: TopologyMovePoint;
}
export interface FaceAreaChange {
    readonly faceId: FaceId;
    readonly beforeAreaUm2: AreaUm2;
    readonly afterAreaUm2: AreaUm2;
}
export interface TopologyMovePoint {
    readonly xUm: CoordinateUm;
    readonly yUm: CoordinateUm;
}
interface TopologyMoveMetadataBase {
    readonly nodeChanges: readonly NodeCoordinateChange[];
    /** Every wall with at least one moved endpoint. */
    readonly affectedWallIds: readonly WallId[];
    /** Walls whose two endpoints received the same displacement. */
    readonly translatedWallIds: readonly WallId[];
    /** Affected walls whose endpoint displacements differ. */
    readonly resizedWallIds: readonly WallId[];
    readonly preservedFaceIds: readonly FaceId[];
    readonly faceCountBefore: number;
    readonly faceCountAfter: number;
    /** Only faces whose exact derived area changed are included. */
    readonly faceAreaChanges: readonly FaceAreaChange[];
}
export interface WallPerpendicularMoveMetadata extends TopologyMoveMetadataBase {
    readonly kind: "wallPerpendicular";
    readonly wallId: WallId;
    readonly orientation: WallOrientation;
    readonly offsetUm: CoordinateUm;
    /** The complete same-axis run translated with the selected segment. */
    readonly wallRunIds: readonly WallId[];
}
export interface JunctionMoveMetadata extends TopologyMoveMetadataBase {
    readonly kind: "junction";
    readonly nodeId: NodeId;
    readonly target: TopologyMovePoint;
    readonly deltaXUm: CoordinateUm;
    readonly deltaYUm: CoordinateUm;
    readonly xConstraintNodeIds: readonly NodeId[];
    readonly yConstraintNodeIds: readonly NodeId[];
}
export type TopologyMoveMetadata = WallPerpendicularMoveMetadata | JunctionMoveMetadata;
export interface TopologyMoveResult {
    readonly topology: TopologyV2;
    readonly metadata: TopologyMoveMetadata;
}
/**
 * Moves the maximal collinear run containing `wallIdentity` perpendicular to
 * that run. Shared nodes move with it and perpendicular incident walls resize.
 */
export declare function moveWallPerpendicular(topologyValue: TopologyV2, wallIdentity: WallId, offsetUmValue: number): TopologyMoveResult;
/**
 * Moves a canonical junction while propagating only the coordinate constraints
 * required to keep every incident and continued wall orthogonal.
 */
export declare function moveJunction(topologyValue: TopologyV2, nodeIdentity: NodeId, targetValue: TopologyMovePoint): TopologyMoveResult;
export {};
//# sourceMappingURL=movement.d.ts.map
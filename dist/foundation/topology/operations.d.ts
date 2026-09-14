import { type CoordinateUm, type LengthUm } from "../core/units.js";
import { type NodeId, type TopologyNode, type TopologyV2, type TopologyWall, type WallId } from "./model.js";
export interface TopologyPoint {
    readonly xUm: CoordinateUm;
    readonly yUm: CoordinateUm;
}
export interface WallProposal {
    readonly start: TopologyPoint;
    readonly end: TopologyPoint;
    readonly thicknessUm: LengthUm;
}
export type PointIntersectionKind = "endpointEndpoint" | "proposedEndpointToExistingInterior" | "existingEndpointToProposedInterior" | "interiorCrossing";
export interface PointWallIntersection {
    readonly kind: PointIntersectionKind;
    readonly wallId: WallId;
    readonly point: TopologyPoint;
}
export interface CollinearWallConflict {
    readonly kind: "exactDuplicate" | "collinearOverlap";
    readonly wallId: WallId;
}
export type WallIntersection = PointWallIntersection | CollinearWallConflict;
export interface TopologyOperationOptions {
    /** Stable caller-controlled token used to derive any required n-/w- IDs. */
    readonly idSeed: string;
}
export interface TopologyChangeResult {
    readonly topology: TopologyV2;
    readonly createdNodeIds: NodeId[];
    readonly createdWallIds: WallId[];
    readonly removedWallIds: WallId[];
    readonly insertedWallIds: WallId[];
    readonly wallReplacements: Record<string, WallId[]>;
}
export declare class TopologyOperationError extends Error {
    constructor(message: string);
}
export declare function findNodeAtCoordinate(topology: TopologyV2, point: TopologyPoint): TopologyNode | undefined;
export declare function getWallsAtNode(topology: TopologyV2, id: NodeId): TopologyWall[];
export declare function findWallIntersections(topologyValue: TopologyV2, proposalValue: WallProposal): WallIntersection[];
export declare function splitWallAtPoint(topologyValue: TopologyV2, wallIdentity: WallId, pointValue: TopologyPoint, options: TopologyOperationOptions): TopologyChangeResult;
export declare function insertWall(topologyValue: TopologyV2, proposalValue: WallProposal, options: TopologyOperationOptions): TopologyChangeResult;
//# sourceMappingURL=operations.d.ts.map
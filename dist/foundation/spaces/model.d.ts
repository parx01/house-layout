import type { AreaUm2, CoordinateUm } from "../core/units.js";
import type { NodeId, WallId } from "../topology/model.js";
declare const faceIdBrand: unique symbol;
export type FaceId = string & {
    readonly [faceIdBrand]: "FaceId";
};
export interface DirectedWallHalfEdgeRef {
    readonly wallId: WallId;
    /** Forward follows the wall's stored startNodeId -> endNodeId direction. */
    readonly direction: "forward" | "reverse";
}
export interface DerivedFaceVertex {
    readonly nodeId: NodeId;
    readonly xUm: CoordinateUm;
    readonly yUm: CoordinateUm;
}
export interface DerivedBoundedFace {
    readonly id: FaceId;
    /** Project coordinates use SVG-style downward Y, so positive area is clockwise. */
    readonly winding: "clockwise";
    readonly boundary: readonly DirectedWallHalfEdgeRef[];
    readonly vertices: readonly DerivedFaceVertex[];
    readonly areaUm2: AreaUm2;
}
export interface DerivedFaceSetV1 {
    readonly modelVersion: 1;
    readonly topologyModelVersion: 1;
    readonly faces: readonly DerivedBoundedFace[];
    /** Bridges cannot bound a planar face and are intentionally omitted. */
    readonly ignoredBridgeWallIds: readonly WallId[];
    /** Exterior walks are observed for diagnostics but never returned as faces. */
    readonly excludedExteriorWalkCount: number;
}
export declare function faceId(value: string): FaceId;
export {};
//# sourceMappingURL=model.d.ts.map
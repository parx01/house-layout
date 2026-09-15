import { type AreaUm2, type LengthUm } from "../core/units.js";
import type { DirectedWallHalfEdgeRef, FaceId } from "../spaces/model.js";
import { type NodeId, type TopologyV2, type WallId } from "../topology/model.js";
export interface TopologySvgPoint {
    readonly nodeId: NodeId;
    readonly x: number;
    readonly y: number;
}
export interface TopologySvgFace {
    readonly id: FaceId;
    readonly points: readonly TopologySvgPoint[];
    readonly pointsAttribute: string;
    readonly boundary: readonly DirectedWallHalfEdgeRef[];
    readonly areaUm2: AreaUm2;
    readonly areaLabel: string;
    readonly labelX: number;
    readonly labelY: number;
}
export interface TopologySvgWall {
    readonly id: WallId;
    readonly startNodeId: NodeId;
    readonly endNodeId: NodeId;
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
    readonly thicknessUm: LengthUm;
    readonly strokeWidth: number;
    readonly lengthUm: LengthUm;
    readonly lengthLabel: string;
    readonly thicknessLabel: string;
}
export interface TopologySvgJunction {
    readonly id: NodeId;
    readonly x: number;
    readonly y: number;
    readonly degree: number;
    readonly xLabel: string;
    readonly yLabel: string;
}
export interface TopologySvgRenderModel {
    readonly faces: readonly TopologySvgFace[];
    readonly walls: readonly TopologySvgWall[];
    readonly junctions: readonly TopologySvgJunction[];
    readonly ignoredBridgeWallIds: readonly WallId[];
    readonly excludedExteriorWalkCount: number;
}
/**
 * Pure adapter from canonical topology to SVG display data. Coordinates are
 * scaled from exact integer micrometres to the editor's millimetre viewBox;
 * no geometry is inferred from legacy room rectangles.
 */
export declare function createTopologySvgRenderModel(topologyValue: TopologyV2): TopologySvgRenderModel;
//# sourceMappingURL=topology-renderer.d.ts.map